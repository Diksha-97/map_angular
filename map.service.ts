import { DutyStoppageDetailRequest, DutyStoppageDetailsWithPNRRequest, DutyStoppageDetailsWithPNRResponse, DutystoppagedetailWithPNR } from './../pages/reports/report.model';
import { EnforcedVehicleRequest, EnforcementDetailsResponse, EnforcementVehicleDetails, GeomDetailReq, HistoryRequest } from 'src/app/shared/map';
import { CommonService } from './common.service';
import { Injectable } from '@angular/core';
import { NavigationEnd, Router } from '@angular/router';
import View from 'ol/View';
import { boundingExtent, createEmpty, extend, getHeight, getWidth } from 'ol/extent';
import Feature, { FeatureClass, FeatureLike } from 'ol/Feature';
import LineString from 'ol/geom/LineString';
import Point from 'ol/geom/Point';
import TileLayer from 'ol/layer/Tile';
import VectorLayer from 'ol/layer/Vector';
import Map from 'ol/Map';
import Overlay from 'ol/Overlay';
import * as olProj from 'ol/proj';
import { BingMaps, Cluster, Source, Vector, Vector as VectorSource } from 'ol/source';
import OSM from 'ol/source/OSM';
import TileWMS from 'ol/source/TileWMS';
import { Circle as CircleStyle, Fill, Icon, Stroke, Style, Text } from 'ol/style';
import { EventService } from '../core/services/event.service';
import { GeomCreateReq, GeomDetails, HistoryResponse, VehicleOnMapDAO } from './map';
import Layer from 'ol/layer/Layer';
import { Geometry, Polygon } from 'ol/geom';
import { SOSDetails } from '../pages/alert-configuration/sos-event/sos.mode';
import { LiveStatus_DetailsReq } from '../pages/operation/livestatus/livestatus';
import { BusWiseAlertDetails, BuswisealertcountdetailsReq } from '../pages/alert-configuration/emergency-alert-details/alert.modal';
import { getVectorContext } from 'ol/render.js';
import { Inertia, OrderedListTemplate, color, string } from '@amcharts/amcharts4/core';
import TileSource from 'ol/source/Tile';
import { TruncatePipe } from './truncate.pipe';
import { easeOut, easeIn, } from 'ol/easing';
import { Extent } from 'ol/extent';
import { RasterSourceEvent } from 'ol/source/Raster';
import { unByKey } from 'ol/Observable';
import * as moment from 'moment';
import { DutyStoppageDetailsResponse, Dutystoppagedetail } from '../pages/reports/report.model';
import { ScaleLine, defaults as defaultControls } from 'ol/control';
import { DatePipe } from '@angular/common';
import { DepotDetailResponse } from '../pages/dashboard/stateadmin/stateadmin.model';
import { APINAME } from './apiname';
import VectorTileLayer from 'ol/layer/VectorTile';
import VectorTileSource from 'ol/source/VectorTile';
import MVT from 'ol/format/MVT';
import { Subscription } from 'rxjs';

declare var gifler: any;

@Injectable({
  providedIn: 'root'
})


export class MapService {


  constructor(private router: Router,
    public apiService: EventService,
    private truncatePipe: TruncatePipe,
    public commonService: CommonService,
    private datePipe: DatePipe
  ) {

  }

  map: Map;
  content: any;
  popup: Overlay;
  popupData: VehicleOnMapDAO = new VehicleOnMapDAO();
  busWiseAlertDetail: BusWiseAlertDetails = new BusWiseAlertDetails();

  nextStop: string = "";

  historyAlertList: { alertid: string, alertname: string, alertcount: number, visible: boolean }[] = [];

  // source and layer for vehicle icon 
  geometryLayer: VectorLayer<VectorSource> = new VectorLayer({
    source: new VectorSource({ wrapX: false }),
    properties: {
      name: 'geometrylayer'
    }
  });


  clusterSyleFunction = (feature: FeatureLike, resolution: any) => {

    if (resolution != this.currentResolution) {
      this.currentResolution = resolution;
    }
    this.calculateClusterInfo(resolution);

    let style;
    const size = feature.get('features').length;
    if (size > 1) {
      var color: any;
      if (size > 200) {
        color = [134, 232, 255]
      } else if (size > 100) {
        color = [164, 255, 255]
      } else if (size > 30) {
        color = [237, 240, 139]
      } else {
        color = [180, 242, 133]
      }
      style = new Style({
        image: new CircleStyle({
          radius: feature.get('radius'),
          fill: new Fill({
            color: color,
          }),
          // stroke: new Stroke({
          //   color: "#808080"
          // })
        }),
        text: new Text({
          text: size.toString(),
          font: "bold 12px serif",
          fill: new Fill({
            color: '#000',
          }),

        }),
      });


    } else {
      const originalFeature = feature.get('features')[0];
      style = this.createClusterIconStyle(originalFeature);
    }


    return style;
  }



  // cluster layer

  clusterLayer: VectorLayer<Cluster> = new VectorLayer({
    source: new Cluster({
      distance: 40,
      source: new VectorSource({
        wrapX: false
      })
    }),
    style: this.clusterSyleFunction,
    properties: {
      name: 'clusterlayer'
    }
  })


  // enforcementClusterLayer: VectorLayer<Cluster> = new VectorLayer({
  //   source: new Cluster({
  //     distance: 40,
  //     source: new VectorSource({
  //       wrapX: false
  //     })
  //   }),
  //   style: this.enforcementClusterSyleFunction,
  //   properties: {
  //     name: 'enforcementclusterlayer'
  //   }
  // })


  // source and layer for vehicle icon 
  liveVehicleIconLayer: VectorLayer<VectorSource> = new VectorLayer({
    source: new VectorSource({ wrapX: false }),
    properties: {
      name: 'livevehiclelayer'
    }
  });


  // source and layer for drection icon 
  livedirectionIconLayer: VectorLayer<VectorSource> = new VectorLayer({
    source: new VectorSource({ wrapX: false }),
    properties: {
      name: 'livedirectionlayer'
    }
  })


  // source and layer for route 
  liveRouteLayer: VectorLayer<VectorSource> = new VectorLayer({
    source: new VectorSource({ wrapX: false }),
    properties: {
      name: 'liveroutelayer'
    }
  })




  //history source and layer for vehicle icon 
  historyVehicleIconLayer: VectorLayer<VectorSource> = new VectorLayer({
    source: new VectorSource({ wrapX: false }),
    properties: {
      name: 'historyvehiclelayer'
    }
  });


  //history source and layer for drection icon 
  historyDirectionIconLayer: VectorLayer<VectorSource> = new VectorLayer({
    source: new VectorSource({ wrapX: false }),
    properties: {
      name: 'historydirectionlayer'
    }
  })


  // source and layer for route 
  historyRouteLayer: VectorLayer<VectorSource> = new VectorLayer({
    source: new VectorSource({ wrapX: false }),
    properties: {
      name: 'historyroutelayer'
    }
  })



  trackMovementLayer: VectorLayer<VectorSource> = new VectorLayer({
    source: new VectorSource({ wrapX: false }),
    properties: {
      name: 'trackmovementlayer'
    }
  })


  alertLayer: VectorLayer<VectorSource> = new VectorLayer({
    source: new VectorSource({ wrapX: false }),
    properties: {
      name: 'alertlayer'
    }
  })


  dutyStoppageLayer: VectorLayer<VectorSource> = new VectorLayer({
    source: new VectorSource({ wrapX: false }),
    properties: {
      name: 'dutystoppagelayer'
    }
  })


  enforcementVehicleLayer: VectorLayer<VectorSource> = new VectorLayer({
    source: new VectorSource({ wrapX: false }),
    properties: {
      name: 'enforcementvehiclelayer'
    }
  })

  OSMLayer = new TileLayer({
    visible: true,
    preload: Infinity,
    source: new OSM(),
    properties: {
      name: 'osmlayer',
    }
  });

  //layers === 1 ===== Bing Map
  // BingLayer = new TileLayer({
  //   visible: false,
  //   preload: Infinity,
  //   source: new BingMaps({
  //     key: 'AmefluG7nwzUhmiQdE2HBEOdY7ebJVIdQIiuGGXZoQIpqbdPjFQkgjfSPh6zVDRu',
  //     imagerySet: 'Road'
  //   }),
  //   properties: {
  //     name: 'binglayer',
  //   }
  // });

  // layers === 2   ===== Bing Map Hybrid Layer
  // bingHybridLayer = new TileLayer({
  //   visible: false,
  //   preload: Infinity,
  //   source: new BingMaps({
  //     // key: 'AhBtRPUBkIZU0AUxwPe2u6x2F-JGdD3laQfOl8two4BfWOhdS5ZXjNz79m4-GegU',
  //     key: 'AmefluG7nwzUhmiQdE2HBEOdY7ebJVIdQIiuGGXZoQIpqbdPjFQkgjfSPh6zVDRu',
  //     imagerySet: 'AerialWithLabels'
  //   }),
  //   properties: {
  //     name: 'binghybridlayer',
  //   }
  // });

  tomtomLayer = new TileLayer({
    visible: false,
    preload: Infinity,
    extent: [-20037508, -20037508, 20037508, 20037508],
    source: new TileWMS({
      url: 'https://api.tomtom.com/map/1/wms/?request=GetMap&srs=EPSG%3A3857&bbox=-0.489%2C51.28%2C0.236%2C51.686&width=512&height=512&format=image%2Fpng&layers=basic&version=1.1.1&key=I18s7OByirZU7TldZeRYxdjYpiaPgqww',   //DSItVlJaGq6ljZm9iBdyGBHoI4tNflTc
      //    type: 'base',
      params: {
        'LAYERS': 'generalLayers:India_State_region',//'IndiaLayer',
        'TILED': true,
        'CRS': 'EPSG:4326'
      },
      serverType: 'geoserver',
    }),
    properties: {
      name: 'tomtomlayer',
    }
  });

  // wms layer  3
  SRTCLayer = new TileLayer({
    visible: false,
    preload: Infinity,
    extent: [-20037508, -20037508, 20037508, 20037508],
    source: new TileWMS({
      url: "https://vts.intaliatech.com/geoserver/RSRTC/wms",
      params: {
        'LAYERS': 'RSRTC:RSRTC',//'IndiaLayer',
        'TILED': true,
        'CRS': 'EPSG:4326'
      },
      serverType: 'geoserver'
    }),
    properties: {
      name: 'indialayer',
    }
  })

  IndiaLayer = new TileLayer({
    visible: true,
    preload: Infinity,
    extent: [-20037508, -20037508, 20037508, 20037508],
    source: new TileWMS({
      url: "https://vts.intaliatech.com/geoserver/RSRTC/wms?service=WMS&version=1.1.0&request=GetMap&layers=RSRTC%3AIndia_State_region&bbox=68.170825%2C6.755597%2C97.404631%2C37.085228&width=740&height=768&srs=EPSG%3A4326&styles=&format=image/png&transparent=true",
      // url: "https://vts.intaliatech.com/geoserver/RSRTC/wms?service=WMS&version=1.1.0&request=GetMap&layers=RSRTC%3ADepotPolygon-polygon&bbox=71.4098181786324%2C23.0127233339558%2C77.4807740472418%2C29.9141828130225&width=675&height=768&srs=EPSG%3A4326&styles=&format=image/png&transparent=true",
      params: {
        // 'LAYERS': 'RSRTC:DepotPolygon-polygon',//'IndiaLayer',
        // 'TILED': true,
        // 'CRS': 'EPSG:4326',
      },
      serverType: 'geoserver'
    }),
    properties: {
      name: 'indialayer',
    }
  })


  busDepotLayer = new TileLayer({
    visible: true,
    preload: Infinity,
    extent: [-20037508, -20037508, 20037508, 20037508],
    source: new TileWMS({
      // url: "https://vts.intaliatech.com/geoserver/RSRTC/wms",
      url: "https://vts.intaliatech.com/geoserver/RSRTC/wms?service=WMS&version=1.1.0&request=GetMap&layers=RSRTC%3ADepotPolygon-polygon&bbox=71.4098181786324%2C23.0127233339558%2C77.4807740472418%2C29.9141828130225&width=675&height=768&srs=EPSG%3A4326&styles=&format=image/png&transparent=true",
      params: {
        // 'LAYERS': 'RSRTC:DepotPolygon-polygon',//'IndiaLayer',
        // 'TILED': true,
        // 'CRS': 'EPSG:4326',
      },
      serverType: 'geoserver'
    }),
    properties: {
      name: 'busdepotlayer',
    }
  })

  busDepotByNameLayer: TileLayer<TileSource> = new TileLayer({
    visible: true,
    preload: Infinity,
    extent: [-20037508, -20037508, 20037508, 20037508],
    properties: {
      name: 'busdepotbynamelayer'
    }
  });



  busStopLayer = new TileLayer({
    visible: true,
    preload: Infinity,
    extent: [-20037508, -20037508, 20037508, 20037508],
    source: new TileWMS({
      url: "  https://vts.intaliatech.com/geoserver/RSRTC/wms?service=WMS&version=1.1.0&request=GetMap&layers=RSRTC%3Atblgeomdata&bbox=70.51031494140625%2C20.644498825073242%2C80.98863220214844%2C33.0545768737793&width=648&height=768&srs=EPSG%3A4326&styles=&format=image/png&transparent=true",
      // url: "https://vts.intaliatech.com/geoserver/RSRTC/wms?service=WMS&version=1.1.0&request=GetMap&layers=RSRTC%3ADepotPolygon-polygon&bbox=71.4098181786324%2C23.0127233339558%2C77.4807740472418%2C29.9141828130225&width=675&height=768&srs=EPSG%3A4326&styles=&format=image/png&transparent=true",
      params: {
        // 'LAYERS': 'RSRTC:DepotPolygon-polygon',//'IndiaLayer',
        // 'TILED': true,
        // 'CRS': 'EPSG:4326',
      },
      serverType: 'geoserver'
    }),
    properties: {
      name: 'busstoplayer',
    }
  })


  view: View = new View({
    center: olProj.fromLonLat([74.95210183403707, 28.29892511126661]),
    zoom: 8,
    maxZoom: 19,
    minZoom: 4,
    extent: [5487495.487890043, 1442187.7339280488, 12475246.949187092, 4219442.504659038]
  })

  listSwitcher = [
    { text: 'OSM', flag: 'assets/mapimages/mapLayers/osm.JPG', lang: 'osmlayer', index: 0 },
    { text: 'Bing', flag: 'assets/mapimages/mapLayers/bingmap.JPG', lang: 'binglayer', index: 1 },
    { text: 'Bing Hybrid', flag: 'assets/mapimages/mapLayers/binghybrid.JPG', lang: 'binghybridlayer', index: 2 },
    { text: 'India Layer', flag: 'assets/mapimages/mapLayers/india.JPG', lang: 'indialayer', index: 3 },
    { text: 'Tom Tom', flag: 'assets/mapimages/mapLayers/tomtom.JPG', lang: 'tomtomlayer', index: 4 },

  ];

  scaleLine = new ScaleLine({
    bar: true,
    text: true,
    minWidth: 125,
    maxWidth: 200,
    steps: 4,
    units: 'metric',

  });


  flashList: any[] = []
  renderMap(target) {
    try {
      this.map = new Map({
        layers: [],
        target: target,
        view: this.view,
      });

    } catch (error) {
    }

    this.map.getView().animate({
      center: olProj.fromLonLat([74.95210183403707, 28.29892511126661]),
      zoom: 8,
    })

    this.map.addLayer(this.OSMLayer);
    // this.map.addLayer(this.BingLayer);
    // this.map.addLayer(this.bingHybridLayer);
    this.map.addLayer(this.SRTCLayer);
    this.map.addLayer(this.tomtomLayer);
    this.map.addLayer(this.IndiaLayer);
    this.map.addLayer(this.busDepotLayer);
    this.map.addLayer(this.busDepotByNameLayer);
    this.map.addLayer(this.busStopLayer);

    this.map.addLayer(this.geometryLayer);
    this.map.addLayer(this.clusterLayer);

    this.map.addLayer(this.historyRouteLayer);
    this.map.addLayer(this.historyDirectionIconLayer);
    this.map.addLayer(this.historyVehicleIconLayer);

    this.map.addLayer(this.liveRouteLayer);
    this.map.addLayer(this.livedirectionIconLayer);
    this.map.addLayer(this.liveVehicleIconLayer);

    this.map.addLayer(this.enforcementVehicleLayer)

    this.map.addLayer(this.trackMovementLayer);

    this.map.addLayer(this.dutyStoppageLayer);

    this.map.addLayer(this.alertLayer);
    this.map.addControl(this.scaleLine);


    this.clearAllLayers();

    for (let i = 0; i < 4; i++) {
      if (this.map.getAllLayers()[i].getProperties().name == 'osmlayer') {
        this.map.getAllLayers()[i].setVisible(true);
        this.currentLayerName = this.map.getAllLayers()[i].getProperties().name
      }
      else {
        this.map.getAllLayers()[i].setVisible(false);

      }
    }



    this.map.on("pointermove", (evt: any) => {
      var hit = this.map.forEachFeatureAtPixel(evt.pixel, (feature: FeatureLike, layer: Layer) => {
        return true;
      });
      if (hit) {
        try {
          this.map.getTargetElement().style.cursor = 'pointer';
        } catch (error) { }
      } else {
        try {
          this.map.getTargetElement().style.cursor = '';
        } catch (error) { }
      }
    });

    this.map.on('singleclick', (evt) => {
      this.map.forEachFeatureAtPixel(evt.pixel, (feature: FeatureLike, layer: Layer) => {

        try {
          let property = feature.getProperties();
          if (layer.getProperties().name == 'clusterlayer') {
            if (feature.getProperties().features.length == 1) {
              this.popupData = new VehicleOnMapDAO();
              this.popupData = ((feature.getProperties().features[0] as FeatureLike).getProperties().properties as VehicleOnMapDAO);
              let livestatusReq = new LiveStatus_DetailsReq();
              livestatusReq.imeino = this.popupData.deviceimeino;
              if (this.popupData.pollingstatus?.toLowerCase() == 'non polling') {
                livestatusReq.searchbytype = '52';
              }
              this.apiService.post(livestatusReq, 'livevehiclestatus').subscribe((response: any) => {
                if (response.producerstatuscode == 200) {
                  let liveData: VehicleOnMapDAO = response.producerresponse.livevehicledetails[0];
                  this.popupData = liveData;
                }
                this.popupData.trackingtype = 'cluster';
              })
            }

          }

          if (layer.getProperties().name == 'enforcementvehiclelayer') {
            let livestatusReq = new LiveStatus_DetailsReq()
            livestatusReq.imeino = feature.getProperties().properties.deviceimeino;
            this.apiService.post(livestatusReq, 'livevehiclestatus').subscribe((response: any) => {
              if (response.producerstatuscode == 200) {
                let liveData: VehicleOnMapDAO = response.producerresponse.livevehicledetails[0];
                this.popupData = liveData;
              }
              this.popupData.trackingtype = 'cluster';
            })
          }
          if (layer.getProperties().name == 'historydirectionlayer' || layer.getProperties().name == 'historyvehiclelayer'
            || layer.getProperties().name == 'livevehiclelayer' || layer.getProperties().name == 'livedirectionlayer') {
            this.popupData = property.properties as VehicleOnMapDAO;
            if (layer.getProperties().name == "historydirectionlayer") {
              if (property.properties.pollingstatus.toLowerCase() == 'stop') {
                this.popup.setPosition(olProj.fromLonLat([Number(property.properties.longitude), Number(property.properties.latitude)]))
                this.popupData.duration = property.properties.duration;
              }
              else {
                this.popup.setPosition(undefined);
              }
            }
          }
          else if (layer.getProperties().name == 'alertlayer') {
            this.busWiseAlertDetail = property.properties;
          }

          else if (layer.getProperties().name == 'geometrylayer') {
          }
        } catch (e) { }
      })
    });


    // this.alertLayer.getSource().on('addfeature', (e) => {
    //   this.flashList.push(e.feature.getProperties().properties);
    // setInterval(() => {
    // this.flash(e.feature)
    // }, 2000);
    // })


  }

  currentLayerName = '';

  switchLayer(item) {
    for (let i = 0; i <= 4; i++) {
      let currentLayer = this.map.getAllLayers()[i];
      if (currentLayer.getProperties().name == item) {
        currentLayer.setVisible(true)
        this.currentLayerName = item;
      }
      else {
        currentLayer.setVisible(false)
      }
    }
  }


  showPopup(container, content, closer) {
    try {
      this.popup.setPosition(undefined);
      closer.blur();
    } catch (error) { }

    this.content = content;

    this.popup = new Overlay({
      element: container,
      autoPan: true,
      // autoPanAnimation: {
      //   duration: 250,
      // },

    });

    try {
      this.map.addOverlay(this.popup);
    }
    catch (e) { alert(e) }


    try {
      closer.onclick = () => {

        this.popup.setPosition(undefined);
        closer.blur();

        // this.selectedVehicleOnMap = new VehicleOnMapDAO();
        return false;
      };
    } catch (error) { }


  }

  setPopupDetails(data, coord) {

    this.popupData = data;

    this.popup.setPosition(coord);
  }



  clearAllLayers() {

    try { this.historyDirectionIconLayer.un('postrender', this.animateHistoryVehicle); } catch (error) { }
    try { this.livedirectionIconLayer.un('postrender', this.animateLiveVehicle); } catch (error) { }


    try { clearTimeout(this.livevehicleOnMapInterval) } catch (e) { clearTimeout(this.livevehicleOnMapInterval); console.warn(e) }
    try { this.clusterLayer.getSource()?.getSource()?.clear() } catch (error) { console.warn('cluster not cleared') }
    try { this.clusterLayer.getSource()?.getSource()?.clear() } catch (error) { console.warn('cluster not cleared') }

    if (this.clusterLayer.getSource().getSource().getFeatures().length > 0) {
      try { this.popupData = new VehicleOnMapDAO() } catch (error) { }
    }
    this.liveroutedata = [];
    this.filteredHistoryData = [];
    this.historyAlertList = [];
    this.currentRouteCoordinates = [];
    this.liveroutedata = [];

    try { this.liveRouteLayer.getSource().clear(); } catch (error) { console.warn('error in clear live route') }
    try { this.liveVehicleIconLayer.getSource().clear(); } catch (error) { console.warn('error in clear live route') }
    this.liveVehicleIconLayer.setVisible(true);
    try { this.livedirectionIconLayer.getSource().clear(); } catch (error) { console.warn('error in clear live route') }


    try { this.historyRouteLayer.getSource().clear(); } catch (error) { console.warn('error in clear history route') }
    try { this.historyVehicleIconLayer.getSource().clear(); } catch (error) { console.warn('error in clear history route') }
    try { this.historyDirectionIconLayer.getSource().clear(); } catch (error) { console.warn('error in clear history route') }

    try { this.enforcementVehicleLayer.getSource().clear() } catch (error) { console.warn("error in enforcement vehicle") }

    this.geomDetails = [];
    try { this.geometryLayer.getSource().clear(); } catch (error) { console.warn('error in clear goemetry') }

    try { this.trackMovementLayer.getSource().clear() } catch (error) { }
    try { this.alertLayer.getSource().clear() } catch (error) { console.warn('error in clear alert layer') }

    this.dutyStoppageData = [];
    try { this.dutyStoppageLayer.getSource().clear() } catch (error) { console.warn('error in clear alert layer') }


    try { this.busDepotByNameLayer.setSource(null); } catch (error) { }


    // this.map.getView().animate({
    //   center: olProj.fromLonLat([74.95210183403707, 28.29892511126661]),
    //   zoom: 8,
    // })
  }


  isDistanceRequired: string = "";

  liveroutedata: any[] = [];
  currentRoute: any;

  liveTrackMovable: boolean = true;

  livevehicleapi: Subscription;
  trackLiveVehicle(imeino: string) {

    let livestatusReq = new LiveStatus_DetailsReq()
    livestatusReq.imeino = imeino
    this.livevehicleapi = this.apiService.post(livestatusReq, 'livevehiclestatus').subscribe((response: any) => {
      if (response.producerstatuscode == 200 && response.producerresponse.livevehicledetails.length > 0) {

        let liveData: VehicleOnMapDAO = response.producerresponse.livevehicledetails[0];
        liveData.gpsdistance = +liveData.gpsdistance

        this.selectedVehicleOnMap = this.popupData ? this.popupData : liveData;

        liveData.speed = +liveData.speed;
        this.popupData = liveData
        this.popupData.trackingtype = 'live';

        this.liveroutedata.push([Number(liveData.longitude), Number(liveData.latitude)]);
        if (this.liveroutedata.length == 1) {
          this.setLiveDirectionIcon(this.popupData);
          this.setLiveVehicleIcon(this.popupData);
          this.livevehicleOnMapInterval = setTimeout(() => {
            this.trackLiveVehicle(this.popupData.deviceimeino);
          }, 10000);
        }
        this.map.getView().on('change:resolution', (event) => {
          this.liveTrackMovable = false;

          setTimeout(() => { this.liveTrackMovable = true }, 20000);
        });

        this.map.on('pointerdrag', () => {
          this.liveTrackMovable = false;

          setTimeout(() => { this.liveTrackMovable = true }, 20000);
        });

        try {
          if (this.liveroutedata.length >= 2) {
            let linecoordinate = [this.liveroutedata[this.liveroutedata.length - 2], this.liveroutedata[this.liveroutedata.length - 1]]
            this.liveDistance = 0;
            this.liveLastTime = new Date()

            this.currentRoute = new LineString(linecoordinate)
            this.currentRoute.transform('EPSG:4326', 'EPSG:3857');
            this.liveVehicleIconLayer.setVisible(false);
            this.livedirectionIconLayer.on('postrender', this.animateLiveVehicle);


            if (this.router.url != '/alerts/sosevent' && !this.router.url.includes('/alerts/alertdetails') && this.liveTrackMovable) {
              this.map.getView().animate({
                center: olProj.fromLonLat([+liveData.longitude, +liveData.latitude]),
                // duration: 10
              })
            }
            else {
            }
          }

          // if (this.router.url != '/alerts/sosevent' && this.liveTrackMovable) {
          //   this.map.getView().animate({
          //     center: olProj.fromLonLat([+liveData.longitude, +liveData.latitude]),
          //     duration: 10z
          //   })
          // }
          // else {
          // }
        } catch (error) { }

      }
      else {


      }
    }, (err) => {
      //ErrorAlert(err.message)
    })
  }





  liveLastTime: any;
  liveDistance: number = 0;

  animateLiveVehicle = (event: any): void => {
    const speed = 50;
    const time = event.frameState.time;
    const elapsedTime = time - this.liveLastTime;
    this.liveDistance = (this.liveDistance + (speed * elapsedTime) / 1e6) % 2;
    this.liveLastTime = time;


    const currentCoordinate = this.currentRoute.getCoordinateAt(
      this.liveDistance > 1 ? 2 - this.liveDistance : this.liveDistance
    );

    // for vehicle animation 

    // this.liveVehicleIconLayer.getSource().getFeatures()[0].setProperties({ properties: this.selectedVehicleOnMap })
    // this.liveVehicleIconLayer.getSource().getFeatures()[0].setStyle(this.historyvehicleStyleFunction);
    // (this.liveVehicleIconLayer.getSource().getFeatures()[0].getGeometry() as Point).setCoordinates(currentCoordinate)

    let position: any = this.liveVehicleIconLayer.getSource().getFeatures()[0].getGeometry().clone();
    position.setCoordinates(currentCoordinate);
    const vectorContext = getVectorContext(event);

    let color: string = '';
    if (this.popupData.pollingstatus.toLowerCase() == 'running') {
      color = '#009933'
    }
    else if (this.popupData.pollingstatus.toLowerCase() == 'idle') {
      color = '#ffcc00'
    }
    else if (this.popupData.pollingstatus.toLowerCase() == 'stop') {
      color = '#0066cc'
    }
    else if (this.popupData.pollingstatus.toLowerCase() == 'non polling' || this.popupData.pollingstatus.toLowerCase() == 'never polling') {
      color = '#ff0000'
    }


    let style: any;
    if (((event.target) as VectorLayer<VectorSource>).getSource().getFeatures()[0].getProperties().properties.vehiclecategoryname.toLowerCase() == 'enforcement') {

      style = new Style({
        image: new Icon({
          anchor: [0.5, 0.5],
          anchorXUnits: 'fraction',
          anchorYUnits: 'fraction',
          src: this.getVehicleIcon(this.popupData.pollingstatus, ((event.target) as VectorLayer<VectorSource>).getSource().getFeatures()[0].getProperties().properties.vehiclecategoryname),// 'assets/mapimages/vehicleicon.png',
          rotateWithView: true,
          rotation: Number(this.selectedVehicleOnMap.vehicledirection) * ((Math.PI) / 180)
        }),
      })

    }
    else {


      style = new Style({
        // image: new Icon({
        //   anchor: [0.5, 0.5],
        //   anchorXUnits: 'fraction',
        //   anchorYUnits: 'fraction',
        //   src: this.getVehicleIcon(this.popupData.pollingstatus),// 'assets/mapimages/vehicleicon.png',
        //   rotateWithView: true,
        //   rotation: Number(this.selectedVehicleOnMap.vehicledirection) * ((Math.PI) / 180)
        // }),
        image: new CircleStyle({
          radius: 8,
          fill: new Fill({ color: color }),
          stroke: new Stroke({
            color: 'black',
            width: 2,
          }),
        }),
        text: new Text({
          text: ((event.target) as VectorLayer<VectorSource>).getSource().getFeatures()[0].getProperties().properties.vehicleregno,
          offsetY: -20,
          fill: new Fill({
            color: '#009900',
          }),
          stroke: new Stroke({
            color: 'white',
            width: 1
          }),
          font: 'bold 10px serif',
        }),
      })
    }

    vectorContext.setStyle(style);
    vectorContext.drawGeometry(position);



    // for route animation
    this.currentRouteCoordinates.push(currentCoordinate);
    var lineStyle = new Style({
      fill: new Fill({
        color: '#000000',
      }),
      stroke: new Stroke({
        color: '#0066ff',
        width: 3,
      })
    });

    let liveRouteFeature = new Feature({
      geometry: new LineString(this.currentRouteCoordinates)
    })

    liveRouteFeature.setStyle(lineStyle);
    liveRouteFeature.setProperties({ properties: this.selectedVehicleOnMap });
    this.liveRouteLayer.getSource().clear();
    this.liveRouteLayer.getSource().addFeature(liveRouteFeature);

    // // for route animation
    // tell OpenLayers to continue the postrender animation

    // if (this.router.url == '/operation/livestatus') {
    //   this.map.getView().animate({
    //     center: currentCoordinate,
    //     rotation: +this.selectedVehicleOnMap.vehicledirection * (Math.PI / 180)
    //   })
    // }


    this.map.render();
    this.map.updateSize();

    if (this.liveDistance >= 0.999) {
      this.livedirectionIconLayer.un('postrender', this.animateLiveVehicle);
      this.setLiveVehicleIcon(this.popupData);
      this.liveVehicleIconLayer.setVisible(true)
      this.setLiveDirectionIcon(this.popupData);
      this.trackLiveVehicle(this.popupData.deviceimeino)
      // this.trackBooking(this.token)
    }
  }

  animateLiveVehicleForBooking = (event: any): void => {

    const speed = 50;
    const time = event.frameState.time;
    const elapsedTime = time - this.liveLastTime;
    this.liveDistance = (this.liveDistance + (speed * elapsedTime) / 1e6) % 2;
    this.liveLastTime = time;


    const currentCoordinate = this.currentRoute.getCoordinateAt(
      this.liveDistance > 1 ? 2 - this.liveDistance : this.liveDistance
    );

    // for vehicle animation 

    // this.liveVehicleIconLayer.getSource().getFeatures()[0].setProperties({ properties: this.selectedVehicleOnMap })
    // this.liveVehicleIconLayer.getSource().getFeatures()[0].setStyle(this.historyvehicleStyleFunction);
    // (this.liveVehicleIconLayer.getSource().getFeatures()[0].getGeometry() as Point).setCoordinates(currentCoordinate)

    let position: any = this.liveVehicleIconLayer.getSource().getFeatures()[0].getGeometry().clone();
    position.setCoordinates(currentCoordinate);
    const vectorContext = getVectorContext(event);

    let color: string = '';
    if (this.popupData.pollingstatus.toLowerCase() == 'running') {
      color = '#009933'
    }
    else if (this.popupData.pollingstatus.toLowerCase() == 'idle') {
      color = '#ffcc00'
    }
    else if (this.popupData.pollingstatus.toLowerCase() == 'stop') {
      color = '#0066cc'
    }
    else if (this.popupData.pollingstatus.toLowerCase() == 'non polling' || this.popupData.pollingstatus.toLowerCase() == 'never polling') {
      color = '#ff0000'
    }


    // return new Style({
    //   image: new CircleStyle({
    //     radius: 8,
    //     fill: new Fill({ color: color }),
    //     stroke: new Stroke({
    //       color: 'black',
    //       width: 2,
    //     }),
    //   }),


    let style = new Style({
      // image: new Icon({
      //   anchor: [0.5, 0.5],
      //   anchorXUnits: 'fraction',
      //   anchorYUnits: 'fraction',
      //   src: this.getVehicleIcon(this.popupData.pollingstatus),// 'assets/mapimages/vehicleicon.png',
      //   // scale: (1 / Math.pow(resolution, 1 / 4) < 0.8000) ? 0.8 : (1 / Math.pow(resolution, 1 / 4)),
      //   rotateWithView: true,
      //   rotation: Number(this.selectedVehicleOnMap.vehicledirection) * ((Math.PI) / 180)
      // }),


      image: new CircleStyle({
        radius: 8,
        fill: new Fill({ color: color }),
        stroke: new Stroke({
          color: 'black',
          width: 2,
        }),
      }),

      text: new Text({
        text: this.popupData.vehicleregno,
        offsetY: -20,
        fill: new Fill({
          color: '#009900'
        }),
        stroke: new Stroke({
          color: 'white',
          width: 1
        }),
        font: 'bold 10px serif'
      })
    })
    vectorContext.setStyle(style);
    vectorContext.drawGeometry(position);



    // for route animation
    this.currentRouteCoordinates.push(currentCoordinate);
    var lineStyle = new Style({
      fill: new Fill({
        color: '#000000',
      }),
      stroke: new Stroke({
        color: '#0066ff',
        width: 3,
      })
    });

    let liveRouteFeature = new Feature({
      geometry: new LineString(this.currentRouteCoordinates)
    })

    liveRouteFeature.setStyle(lineStyle);
    liveRouteFeature.setProperties({ properties: this.selectedVehicleOnMap });
    this.liveRouteLayer.getSource().clear();
    this.liveRouteLayer.getSource().addFeature(liveRouteFeature);

    // // for route animation
    // tell OpenLayers to continue the postrender animation
    this.map.render();
    this.map.updateSize();

    if (this.liveDistance >= 0.999) {
      this.livedirectionIconLayer.un('postrender', this.animateLiveVehicleForBooking);
      this.setLiveVehicleIcon(this.popupData);
      this.liveVehicleIconLayer.setVisible(true)
      this.setLiveDirectionIcon(this.popupData);
      // this.trackLiveVehicle(this.popupData.deviceimeino)
      this.trackBooking(this.token)
    }

  }

  filteredHistoryData: VehicleOnMapDAO[] = [];
  fetchingHistory: boolean = false;
  async trackHistoryVehicle(deviceimeino: string, fromdate: string, fromtime: string, todate: string, totime: string, searchtype?: 'routedeviation' | '', hidestartpoint?: boolean, hideendpoint?: boolean) {
    this.historyRouteLayer.getSource().clear();
    this.historyIntervalIndex = 1;
    this.animationStatus = 'stopped'
    this.routeFeatures = [];
    this.routeArray = [];
    this.finalRouteArray = [];
    const historyRequest: HistoryRequest = new HistoryRequest()
    historyRequest.imeino = deviceimeino;
    historyRequest.fromdate = fromdate;
    historyRequest.fromtime = fromtime;
    historyRequest.todate = todate;
    historyRequest.totime = totime;
    historyRequest.searchbytype = searchtype ? searchtype : '';

    this.fetchingHistory = true;


    await this.apiService.post(historyRequest, 'historytrack').toPromise().then(async (response) => {
      if (response.producerstatuscode == 200 && response.producerresponse.historytrackdetails.length > 0) {
        let historyResponse: HistoryResponse[] = <HistoryResponse[]>response.producerresponse.historytrackdetails;

        let historydata: VehicleOnMapDAO[] = [];

        this.popupData.totaldistance = response.producerresponse.distance ? response.producerresponse.distance : 0;
        this.popupData.maxspeed = response.producerresponse.maxspeed ? response.producerresponse.maxspeed : 0;
        this.popupData.totalIdleTime = response.producerresponse.totalidletime ? response.producerresponse.totalidletime : 'Not Found';
        this.popupData.totalRunningTime = response.producerresponse.totalrunningtime ? response.producerresponse.totalrunningtime : "Not Found";
        this.popupData.totalStoppageTime = response.producerresponse.totalstoppagetime ? response.producerresponse.totalstoppagetime : "Not Found";
        this.popupData.commutedistance = this.popupData.totaldistance ? this.popupData.totaldistance : '0';

        this.popupData.trackingtype = 'history';
        this.selectedVehicleOnMap.totaldistance = response.producerresponse.distance;
        this.selectedVehicleOnMap.maxspeed = response.producerresponse.maxspeed;
        this.selectedVehicleOnMap.totalIdleTime = response.producerresponse.totalidletime;
        this.selectedVehicleOnMap.totalRunningTime = response.producerresponse.totalrunningtime;
        this.selectedVehicleOnMap.totalStoppageTime = response.producerresponse.totalstoppagetime;
        this.selectedVehicleOnMap.trackingtype = 'history';

        let historyAlertData: BusWiseAlertDetails[] = [];
        for (let i = 0; i < historyResponse.length; i++) {
          let historydataindex: VehicleOnMapDAO = new VehicleOnMapDAO();
          historydataindex.alertid = historyResponse[i].alertid;

          // historydataindex.alertname = historyResponse[i];
          // historydataindex.batterystatus = historyResponse[i]. ;
          historydataindex.commutedistance = historyResponse[i].commutedistance;
          historydataindex.pollingdatatime = historyResponse[i].datatimestamp;
          historydataindex.depotname = this.popupData.depotname;
          historydataindex.deviceimeino = this.popupData.deviceimeino;
          historydataindex.directionname = historyResponse[i].directionname;
          historydataindex.distance = historyResponse[i].distance;
          historydataindex.duration = historyResponse[i].duration;
          historydataindex.gpsfix = historyResponse[i].gpsfix;
          // historydataindex.gpsstatus = historyResponse[i].alertid;
          historydataindex.gsmsignalstrength = historyResponse[i].gsmsignalstrength;
          historydataindex.ignitionstatus = historyResponse[i].ignition;
          // historydataindex.ignitionstatus = historyResponse[i].igni ;
          historydataindex.latitude = +historyResponse[i].latitude;
          historydataindex.longitude = +historyResponse[i].longitude;
          historydataindex.noofsatellite = historyResponse[i].noofsatellite;
          historydataindex.pollingstatus = historyResponse[i].status;
          historydataindex.rowno = historyResponse[i].rowno;
          historydataindex.speed = +historyResponse[i].speed;
          historydataindex.tamperalert = historyResponse[i].tamperalert;
          historydataindex.trackingtype = 'history';
          historydataindex.vehiclecategoryname = this.popupData.vehiclecategoryname;
          historydataindex.vehicleclassname = this.popupData.vehicleclassname;
          historydataindex.vehicledirection = historyResponse[i].heading;
          historydataindex.vehicleid = this.popupData.vehicleid;
          historydataindex.vehicleownership = this.popupData.vehicleownership;
          historydataindex.vehicleregno = this.popupData.vehicleregno;
          historydataindex.routedeviationstatus = historyResponse[i].routedeviationstatus

          historydataindex.totaldistance = response.producerresponse.distance;
          historydataindex.maxspeed = response.producerresponse.maxspeed;
          historydataindex.totalIdleTime = response.producerresponse.totalidletime;
          historydataindex.totalRunningTime = response.producerresponse.totalrunningtime;
          historydataindex.totalStoppageTime = response.producerresponse.totalstoppagetime;

          historydata.push(historydataindex);

          let historyAlert: BusWiseAlertDetails = new BusWiseAlertDetails();
          if (historyResponse[i].alertid != '1' && historyResponse[i].alertid != '2') {
            historyAlert.alertid = historyResponse[i].alertid;
            historyAlert.alertname = historyResponse[i].alertname;
            historyAlert.alerttime = historyResponse[i].datatimestamp;
            // historyAlert.conductorname = historyResponse[i].  ;
            historyAlert.depotname = historyResponse[i].depotname;
            // historyAlert.dutyname = historyResponse[i].;
            historyAlert.endtime = historyResponse[i].datatimestamp;
            historyAlert.flatitude = historyResponse[i].latitude;
            historyAlert.flongitude = historyResponse[i].longitude;
            historyAlert.ignition = historyResponse[i].ignition;
            // historyAlert.lastbusstop = historyResponse[i].;
            // historyAlert.location = historyResponse[i].location ;
            // historyAlert.mobileno = historyResponse[i].mobil  ;
            historyAlert.pollingstatus = historyResponse[i].status;
            historyAlert.receivedtime = historyResponse[i].datatimestamp;
            // historyAlert.routename = historyResponse[i].rou ;
            historyAlert.rowno = historyResponse[i].rowno;
            // historyAlert.sarthiname = historyResponse[i].sa ;
            historyAlert.speed = historyResponse[i].speed;
            // historyAlert.stoppagename = historyResponse[i]. ;
            // historyAlert.tripname = historyResponse[i].trip ;
            historyAlertData.push(historyAlert);
          }
        }

        // if (this.router.url == '/map/maptracking' || this.router.url == '/operation/livestatus' || this.router.url == '/report/planvsactualreport') {
        // this.plotAllHistoryAlerts(historyAlertData);
        this.historyAlertList = [];
        this.historyAlertDetails = historyAlertData;

        if (this.router.url == '/report/alerteventreport') {

          for (const element of historyAlertData) {
            if (this.historyAlertList.findIndex(x => x.alertid == element.alertid) == -1) {
              this.historyAlertList.push({ alertid: element.alertid, alertname: element.alertname, alertcount: 1, visible: element.alertname == 'SOS Press' ? true : false })
            }
            else {
              this.historyAlertList[this.historyAlertList.findIndex(x => x.alertid == element.alertid)].alertcount++;
            }
            this.toggleAlertFeature(this.historyAlertList[this.historyAlertList.findIndex(x => x.alertname == element.alertname)]);
          }
        }

        // }


        this.filteredHistoryData.push(historydata[0])
        for (let i = 0; i < historydata.length - 1; i++) {

          // if (historydata[i].latitude !== historydata[i + 1].latitude || historydata[i].longitude !== (historydata[i + 1].longitude)) {
          this.filteredHistoryData.push(historydata[i])
          // }
        }

        // this.filteredHistoryData = historydata;
        this.filteredHistoryData.push(historydata[historydata.length - 1])
        let olCoords = this.filteredHistoryData.map(x => olProj.fromLonLat([+x.longitude, +x.latitude]))
        if (this.geometryLayer.getSource().getFeatures().findIndex(x => x.getGeometry().getType().toLowerCase() == 'linestring') >= 0) {
          let routeCoords = ((this.geometryLayer.getSource().getFeatures().filter(x => x.getGeometry().getType().toLowerCase() == 'linestring')[0].getGeometry() as LineString).getCoordinates());
          if (this.router.url != '/report/busstopreport' && this.router.url != '/report/routedeviation') {

            olCoords = olCoords.concat(routeCoords)
          }
          else {

          }
        }
        else {
        }

        if (this.router.url != '/dashboard/depotdashboard') {

          const extent = boundingExtent(olCoords);
          try {
            this.map.getView().fit(extent, { duration: 1000, padding: [100, 50, 200, 350] });
          } catch (error) { }
        }
        this.plotRoute(hidestartpoint, hideendpoint);
        this.fetchingHistory = false;
      }
      else if (response.producerstatuscode != 200) {
        this.popupData.totaldistance = response.producerresponse.distance ? response.producerresponse.distance : 0;
        this.popupData.maxspeed = response.producerresponse.maxspeed ? response.producerresponse.maxspeed : 0;
        this.popupData.totalIdleTime = response.producerresponse.totalidletime ? response.producerresponse.totalidletime : "Not Found";
        this.popupData.totalRunningTime = response.producerresponse.totalrunningtime ? response.producerresponse.totalrunningtime : "Not Found";
        this.popupData.totalStoppageTime = response.producerresponse.totalstoppagetime ? response.producerresponse.totalstoppagetime : "Not Found";
        this.popupData.commutedistance = this.popupData.totaldistance ? this.popupData.totaldistance : '0';

        this.commonService.response_message = "History Not Found";
        this.commonService.show_fail_msg = true;
      }

      this.fetchingHistory = false;
    })

  }

  plotStopIcon() {
    // let stoppageFeatureList: Feature<Geometry>[] = [];
    // for (let i = 0; i < this.filteredHistoryData.length; i++) {
    //   if (this.filteredHistoryData[i].longitude != 0.00000 && this.filteredHistoryData[i].latitude != 0.00000) {
    //     let iconFeature = new Feature({
    //       geometry: new Point(olProj.fromLonLat([Number(this.filteredHistoryData[i].longitude), Number(this.filteredHistoryData[i].latitude)])),
    //     });
    //       if(this.filteredHistoryData[i].pollingstatus.toLowerCase()=='stop') {
    //         iconFeature.setStyle(this.vehicleStoppedStyleFunction)
    //         iconFeature.setProperties({ properties: this.filteredHistoryData[i] });
    //         stoppageFeatureList.push(iconFeature);
    //       }
    //   }
    // }
    // this.historyDirectionIconLayer.getSource().clear();
    // this.historyDirectionIconLayer.getSource().addFeatures(stoppageFeatureList);
  }



  historyIntervaltime: 5000;
  historyIntervalIndex: number = 0;

  animationStatus: string = 'stopped';


  changeAnimation = (event: string) => {

    if (event == 'restart') {
      this.animationStatus = 'running';
      this.historyIntervalIndex = 1;
      this.currentRouteCoordinates = [];




      let olCoords = this.filteredHistoryData.map(x => olProj.fromLonLat([+x.longitude, +x.latitude]))
      const extent = boundingExtent(olCoords);
      try {
        this.map.getView().fit(extent, { duration: 1000, padding: [100, 100, 100, 100] });
      } catch (error) { }




      try { this.historyDirectionIconLayer.un('postrender', this.animateHistoryVehicle); }
      catch (error) { this.historyDirectionIconLayer.un('postrender', this.animateHistoryVehicle); }
      finally { this.historyDirectionIconLayer.un('postrender', this.animateHistoryVehicle); }
      this.alertLayer.getSource().clear()

      try { this.historyRouteLayer.getSource().clear(); } catch (error) { console.warn('error in clear history route') }
      try { this.historyVehicleIconLayer.getSource().clear(); } catch (error) { console.warn('error in clear history route') }
      try { this.historyDirectionIconLayer.getSource().clear(); } catch (error) { console.warn('error in clear history route') }
      // this.clearAllLayers()
      setTimeout(() => {

        if (this.historyIntervalIndex == 1) {
          // if (this.router.url != '/report/depotoutreport') {
          try { this.setStartEndIcon(Number(this.filteredHistoryData[0].longitude), Number(this.filteredHistoryData[0].latitude), "startpoint", this.filteredHistoryData[0]) } catch (e) { console.warn(e) }
          // }

          let historyVehicleFeature = new Feature({ geometry: new Point(olProj.fromLonLat([+this.filteredHistoryData[0].longitude, this.filteredHistoryData[0].latitude])) })

          historyVehicleFeature.setProperties({ properties: this.selectedVehicleOnMap });
          historyVehicleFeature.setStyle(this.historyvehicleStyleFunction)

          this.historyVehicleIconLayer.getSource()?.clear();
          this.historyVehicleIconLayer.getSource()?.addFeature(historyVehicleFeature)
        }
        this.selectedVehicleOnMap = this.filteredHistoryData[this.historyIntervalIndex - 1];
        this.map.updateSize();
        this.historyLineString = new LineString([this.finalRouteArray[this.historyIntervalIndex - 1], this.finalRouteArray[this.historyIntervalIndex]])
        this.historyLineString.transform('EPSG:4326', 'EPSG:3857');
        this.historyDistance = 0;
        this.historyLastTime = new Date();
        this.historyDirectionIconLayer.on('postrender', this.animateHistoryVehicle);
        this.historyIntervalIndex = this.historyIntervalIndex + 1;
      }, 200);

    }
    else if (event == 'play') {
      this.animationStatus = 'running';
      this.selectedVehicleOnMap = this.filteredHistoryData[this.historyIntervalIndex - 1];
      this.setHistoryDirectionIcon(this.selectedVehicleOnMap.longitude, this.selectedVehicleOnMap.latitude, this.selectedVehicleOnMap.directionname, this.selectedVehicleOnMap.vehicledirection, this.selectedVehicleOnMap, 'yellow');

      this.map.updateSize();
      this.historyLineString = new LineString([this.finalRouteArray[this.historyIntervalIndex - 1], this.finalRouteArray[this.historyIntervalIndex]])
      this.historyLineString.transform('EPSG:4326', 'EPSG:3857');
      this.historyDistance = 0;
      this.historyLastTime = new Date();
      this.historyDirectionIconLayer.on('postrender', this.animateHistoryVehicle);
      this.historyIntervalIndex = this.historyIntervalIndex + 1;
    }
    else if (event == 'pause') {


      try { this.historyDirectionIconLayer.un('postrender', this.animateHistoryVehicle); }
      catch (error) { this.historyDirectionIconLayer.un('postrender', this.animateHistoryVehicle); }
      // finally { this.historyDirectionIconLayer.un('postrender', this.animateHistoryVehicle); }

      try { clearTimeout(this.historyAnimationTimeout) }
      catch (error) { clearTimeout(this.historyAnimationTimeout) }
      // finally { clearTimeout(this.historyAnimationTimeout) }
      this.map.updateSize();
      this.animationStatus = 'paused';

    }
    else if (event == 'stop') {
      this.changeAnimation('pause');
      this.historyIntervalIndex = 0;
      try { this.historyRouteLayer.getSource().clear(); } catch (error) { console.warn('error in clear history route') }
      try { this.historyVehicleIconLayer.getSource().clear(); } catch (error) { console.warn('error in clear history route') }
      try { this.historyDirectionIconLayer.getSource().clear(); } catch (error) { console.warn('error in clear history route') }
      try { this.historyIntervalIndex = 0; } catch (error) { console.warn('interval index not found') }
      this.plotRoute()
    }
    else if (event == 'speedchange') {
      if (this.animationStatus == 'running') {
        // this.changeAnimation('pause');
        // setTimeout(() => { this.changeAnimation('play') }, 200);
      }
    }


  }



  historyLastTime: any;
  historyDistance: number = 0;
  historyLineString: LineString;
  currentRouteCoordinates: any[] = [];
  historyAnimationTimeout: any;
  public selectedVehicleOnMap: VehicleOnMapDAO = new VehicleOnMapDAO();

  historyvehicleStyleFunction = (feature: FeatureLike, resolution: any): any => {
    console.log("history vehicle feature", feature.getProperties()['properties'])
    let lastPoint = this.filteredHistoryData[this.historyIntervalIndex - 2];
    let currentPoint = this.filteredHistoryData[this.historyIntervalIndex - 1];

    let direction = Math.atan2(currentPoint.longitude - lastPoint.longitude, currentPoint.latitude - lastPoint.latitude)

    let color: string = '';
    if (feature.getProperties().properties.pollingstatus.toLowerCase() == 'running') {
      color = '#009933'
    }
    else if (feature.getProperties().properties.pollingstatus.toLowerCase() == 'idle') {
      color = '#ffcc00'
    }
    else if (feature.getProperties().properties.pollingstatus.toLowerCase() == 'stop') {
      color = '#0066cc'
    }
    else if (feature.getProperties().properties.pollingstatus.toLowerCase() == 'non polling' || feature.getProperties().properties.pollingstatus.toLowerCase() == 'never polling') {
      color = '#ff0000'
    }


    // return new Style({
    // image: new Icon({
    //   anchor: [0.5, 0.5],
    //   anchorXUnits: 'fraction',
    //   anchorYUnits: 'fraction',
    //   src: this.getVehicleIcon((feature.getProperties().properties as VehicleOnMapDAO).pollingstatus),// 'assets/mapimages/vehicleicon.png',
    //   scale: (1 / Math.pow(resolution, 1 / 4) < 0.8000) ? 0.8 : (1 / Math.pow(resolution, 1 / 4)),
    //   rotateWithView: true,
    //   rotation: direction
    // }),


    if (feature.getProperties()['properties'].vehiclecategoryname.toLowerCase() == 'enforcement') {
      console.log("in if");
      return new Style({
        image: new Icon({
          anchor: [0.5, 0.5],
          anchorXUnits: 'fraction',
          anchorYUnits: 'fraction',
          src: 'assets/mapimages/vehicleicon/enforcement.png',//this.getVehicleIcon((feature.getProperties().properties as VehicleOnMapDAO).pollingstatus),// 'assets/mapimages/vehicleicon.png',
          scale: (1 / Math.pow(resolution, 1 / 4) < 0.8000) ? 0.8 : (1 / Math.pow(resolution, 1 / 4)),
          rotateWithView: true,
          rotation: direction,
          color: color
        })
      })
    }
    else {
      console.log(" in else");
      return new Style({
        image: new CircleStyle({
          radius: 8,
          fill: new Fill({ color: color }),
          stroke: new Stroke({
            color: 'black',
            width: 2,
          }),
        }),
        text: new Text({
          text: (feature.getProperties()['properties'] as VehicleOnMapDAO).vehicleregno,
          offsetY: -20,
          fill: new Fill({
            color: '#000080'
          }),
          stroke: new Stroke({
            color: 'white',
            width: 1
          }),
          font: 'bold 10px serif'
        })
      })
    }
  }


  historyDirectionStyleFunction = (feature: FeatureLike, resolution: any): any => {
    let directionIcon = "";
    let deviation: boolean;

    if (feature.getProperties().properties.pollingstatus.toLowerCase() == 'stop') {
      directionIcon = "assets/mapimages/alerticon/stop.png";
      deviation = false;

    } else if (feature.getProperties().properties.routedeviationstatus == "" || feature.getProperties().properties.routedeviationstatus.toLowerCase() == 'na') {
      deviation = true;
      directionIcon = "assets/mapimages/directionicon/up-arrow.png"
    }
    else {
      deviation = true;
      directionIcon = "assets/mapimages/directionicon/up-arrow-red.png";

    }
    return new Style({
      image: new Icon({
        anchor: [0.5, 0.5],
        anchorXUnits: 'fraction',
        anchorYUnits: 'fraction',
        src: directionIcon, //deviation == true ? 'assets/mapimages/directionicon/up-arrow-red.png' : 'assets/mapimages/directionicon/up-arrow.png',
        // src : 'assets/mapimages/directionicon/north.png',
        // scale: (1 / Math.pow(resolution, 1 / 5) >= 0.8000) ? 0.8 : (1 / Math.pow(resolution, 1 / 5)),
        scale: deviation == true ? (1 / Math.pow(resolution, 1 / 5) >= 0.8000) ? 0.8 : (1 / Math.pow(resolution, 1 / 4)) : 1,
        rotateWithView: true,
        rotation: deviation == true ? Number(feature.getProperties()['properties'].vehicledirection) * ((Math.PI) / 180) : 0,
        // color: color
      })
    })
  }

  historyStartPointStyle = (feature: FeatureLike, resolution: any): any => {
    return new Style({
      image: new Icon({
        anchor: [0.5, 1],
        anchorXUnits: 'fraction',
        anchorYUnits: 'fraction',
        src: 'assets/mapimages/startpoint.png',
        scale: (1 / Math.pow(resolution, 1 / 4) <= 0.6000) ? 0.6 : (1 / Math.pow(resolution, 1 / 4)),
        // rotateWithView: true,
        // rotation: Number(feature.getProperties()['properties'].vehicledirection) * ((Math.PI) / 180)
      })
    })
  }

  historyEndPointStyle = (feature: FeatureLike, resolution: any): any => {
    return new Style({
      image: new Icon({
        anchor: [0.5, 1],
        anchorXUnits: 'fraction',
        anchorYUnits: 'fraction',
        src: 'assets/mapimages/endpoint.png',
        scale: (1 / Math.pow(resolution, 1 / 4) <= 0.6000) ? 0.6 : (1 / Math.pow(resolution, 1 / 4)),
        // rotateWithView: true,
        // rotation: Number(feature.getProperties()['properties'].vehicledirection) * ((Math.PI) / 180)
      })
    })
  }


  AlertPointStyle = (feature: FeatureLike, resolution: any): any => {
    return new Style({
      image: new Icon({
        anchor: [0.5, 0.5],
        anchorXUnits: 'fraction',
        anchorYUnits: 'fraction',
        src: this.getAlertIcon(feature.getProperties().properties.alertname),
        scale: (1 / Math.pow(resolution, 1 / 4) <= 0.5000) ? 0.5 : (1 / Math.pow(resolution, 1 / 4)),
        // rotateWithView: true,
        // rotation: Number(feature.getProperties()['properties'].vehicledirection) * ((Math.PI) / 180)
      })
    })
  }


  historySpeed: number = 10000
  public animateHistoryVehicle = (event: any): void => {
    const time = event.frameState.time;
    const elapsedTime = time - this.historyLastTime;
    this.historyDistance = (this.historyDistance + (this.historySpeed * elapsedTime) / 1e6) % 2;
    this.historyLastTime = time;
    const currentCoordinate = this.historyLineString.getCoordinateAt(this.historyDistance > 1 ? 2 - this.historyDistance : this.historyDistance);
    // for vehicle animation

    this.historyVehicleIconLayer.getSource().getFeatures()[0].setProperties({ properties: this.selectedVehicleOnMap })
    this.historyVehicleIconLayer.getSource().getFeatures()[0].setStyle(this.historyvehicleStyleFunction);
    (this.historyVehicleIconLayer.getSource().getFeatures()[0].getGeometry() as Point).setCoordinates(currentCoordinate)
    //  for vehicle animation

    // for route animation
    this.currentRouteCoordinates.push(currentCoordinate);

    let deviationstatus: boolean = false;
    if (this.selectedVehicleOnMap.routedeviationstatus == '' || this.selectedVehicleOnMap.routedeviationstatus.toLowerCase() == 'na') {
      deviationstatus = false
    }
    else {
      deviationstatus = true;
    }
    var lineStyle = new Style({
      // fill: new Fill({
      //   color: '#000000',
      // }),
      // stroke: new Stroke({
      //   color: '#000000',
      //   width: 5,
      // })

      fill: new Fill({
        // color: '#009900',
        color: deviationstatus == false ? '#009900' : '#ff0000'
        //  weight: 4
      }),
      stroke: new Stroke({
        // color: '#009900',
        color: deviationstatus == false ? '#009900' : '#ff0000',
        width: 3
      })
    });

    let historyRouteFeature = new Feature({
      geometry: new LineString(this.currentRouteCoordinates)
    })

    historyRouteFeature.setStyle(lineStyle);
    historyRouteFeature.setProperties({ properties: this.selectedVehicleOnMap });
    this.historyRouteLayer.getSource().clear()
    this.historyRouteLayer.getSource().addFeature(historyRouteFeature)

    // // for route animation

    // // tell OpenLayers to continue the postrender animation

    this.map.render();
    if (this.historyDistance >= 0.999) {
      this.historyDirectionIconLayer.un('postrender', this.animateHistoryVehicle);
      clearTimeout(this.historyAnimationTimeout);
      // this.historyAnimationTimeout = setTimeout(() => {
      this.setHistoryDirectionIcon(this.selectedVehicleOnMap.longitude, this.selectedVehicleOnMap.latitude, this.selectedVehicleOnMap.directionname, this.selectedVehicleOnMap.vehicledirection, this.selectedVehicleOnMap, 'yellow');
      if (this.historyIntervalIndex > 0 && this.historyIntervalIndex < this.finalRouteArray.length) {
        this.selectedVehicleOnMap = this.filteredHistoryData[this.historyIntervalIndex];
        this.popupData = this.selectedVehicleOnMap;
        // this.map.updateSize();
        this.historyLineString = new LineString([this.finalRouteArray[this.historyIntervalIndex - 1], this.finalRouteArray[this.historyIntervalIndex]])
        this.historyLineString.transform('EPSG:4326', 'EPSG:3857');
        this.historyDistance = 0;
        this.historyLastTime = new Date();
        this.historyDirectionIconLayer.on('postrender', this.animateHistoryVehicle);
        this.historyIntervalIndex = this.historyIntervalIndex + 1;

        this.map.updateSize();

        if (this.selectedVehicleOnMap.rowno === this.filteredHistoryData[this.filteredHistoryData.length - 1].rowno) {
          // if(this.router.url !='/report/depotoutreport') {
          try { this.setStartEndIcon(Number(this.filteredHistoryData[this.filteredHistoryData.length - 1].longitude), Number(this.filteredHistoryData[this.filteredHistoryData.length - 1].latitude), "endpoint", this.filteredHistoryData[this.filteredHistoryData.length - 1]) } catch (e) { console.warn(e) }
          // }
          this.animationStatus = 'stopped';

        }
        else {
        }
      }
      else {
      }
      // }, 1000)

    }
  }


  routeArray: any[] = [];
  finalRouteArray: any[] = [];
  routeFeatures: any[] = [];


  plotRoute(hidestartpoint?: boolean, hideendpoint?: boolean) {
    this.historyIntervalIndex = 1;
    this.animationStatus = 'stopped'
    this.routeFeatures = [];
    this.routeArray = [];
    this.finalRouteArray = [];
    this.historyRouteLayer.getSource().clear();

    // this.routeFeatures = new Array(this.filteredHistoryData.length);

    for (var i = 0; i < this.filteredHistoryData.length; i++) {
      this.routeArray = [];
      this.routeArray.push(Number(this.filteredHistoryData[i].longitude))
      this.routeArray.push(Number(this.filteredHistoryData[i].latitude))
      this.finalRouteArray.push(this.routeArray);
      let popupData = new VehicleOnMapDAO()
      popupData = this.filteredHistoryData[i]
      popupData.trackingtype = "history";
      this.setHistoryDirectionIcon(Number(popupData.longitude), Number(popupData.latitude), popupData.directionname, +popupData.vehicledirection, popupData, 'yellow')
      try {
        if (i > 0) {
          let deviationstatus: boolean = false;
          if (this.filteredHistoryData[i - 1].routedeviationstatus == '' || this.filteredHistoryData[i - 1].routedeviationstatus == 'NA' || this.filteredHistoryData[i].routedeviationstatus == '' || this.filteredHistoryData[i].routedeviationstatus == 'NA') {
            deviationstatus = false;
          }
          else {
            deviationstatus = true;
          }
          let prevCoord = [+this.filteredHistoryData[i - 1].longitude, +this.filteredHistoryData[i - 1].latitude];
          let currentCoord = [+this.filteredHistoryData[i].longitude, +this.filteredHistoryData[i].latitude]

          var lineString = new LineString([prevCoord, currentCoord]);
          lineString.transform('EPSG:4326', 'EPSG:3857');
          var lineStyle = new Style({
            fill: new Fill({
              // color: '#009900',
              color: deviationstatus == false ? '#009900' : '#ff0000'
              //  weight: 4
            }),
            stroke: new Stroke({
              // color: '#009900',
              color: deviationstatus == false ? '#009900' : '#ff0000',
              width: 3
            })
          });

          var feature = new Feature({
            geometry: lineString
          });

          feature.setStyle(lineStyle);
        }

      } catch (error) { }
      if (feature) {
        // this.routeFeatures[i] = feature;
        this.routeFeatures.push(feature);
      }
    }

    this.historyRouteLayer.getSource().clear();
    this.historyRouteLayer.getSource().addFeatures(this.routeFeatures)


    let popupDataStart = new VehicleOnMapDAO();
    popupDataStart = this.filteredHistoryData[0];
    popupDataStart.trackingtype = "history";


    let popupDataEnd = new VehicleOnMapDAO();
    popupDataEnd = this.filteredHistoryData[this.filteredHistoryData.length - 1]
    popupDataEnd.trackingtype = "history";
    if (hidestartpoint != true) {
      try { this.setStartEndIcon(Number(this.filteredHistoryData[0].longitude), Number(this.filteredHistoryData[0].latitude), "startpoint", popupDataStart) } catch (e) { console.warn(e) }
    }
    if (hideendpoint != true) {
      try { this.setStartEndIcon(Number(this.filteredHistoryData[this.filteredHistoryData.length - 1].longitude), Number(this.filteredHistoryData[this.filteredHistoryData.length - 1].latitude), "endpoint", popupDataEnd) } catch (e) { console.warn(e) }
    }


  }





  setHistoryDirectionIcon(longitude, lattitude, direction, deg, popupData: VehicleOnMapDAO, color: string) {
    let iconFeature = new Feature({
      geometry: new Point(olProj.fromLonLat([Number(longitude), Number(lattitude)])),
    })
    iconFeature.setProperties({ properties: popupData })
    iconFeature.setStyle(this.historyDirectionStyleFunction)
    // if(popupData.pollingstatus.toLowerCase() =='stop') {
    this.historyDirectionIconLayer.getSource().addFeatures([iconFeature]);
    // }


    let historyAlertData: BusWiseAlertDetails[] = [];
    let historyAlert: BusWiseAlertDetails = new BusWiseAlertDetails();
    if (popupData.alertid != '1' && popupData.alertid != '2') {
      historyAlert.alertid = popupData.alertid;
      historyAlert.alertname = popupData.alertname;
      historyAlert.alerttime = popupData.pollingdatatime;
      // historyAlert.conductorname = popupData.cond ;
      historyAlert.depotname = popupData.depotname;
      // historyAlert.dutyname = popupData.;
      historyAlert.endtime = popupData.pollingdatatime;
      historyAlert.flatitude = popupData.latitude.toString();
      historyAlert.flongitude = popupData.longitude.toString();
      historyAlert.ignition = popupData.ignition;
      // historyAlert.lastbusstop = popupData.;
      historyAlert.location = popupData.location;
      // historyAlert.mobileno = popupData. ;
      historyAlert.pollingstatus = popupData.pollingstatus;
      historyAlert.receivedtime = popupData.pollingdatatime;
      // historyAlert.routename = popupData.rou ;
      historyAlert.rowno = popupData.rowno;
      // historyAlert.sarthiname = popupData.sa ;
      historyAlert.speed = popupData.speed.toString();
      // historyAlert.stoppagename = popupData. ;
      // historyAlert.tripname = popupData.trip ;

      historyAlertData.push(historyAlert)
    }

    // this.plotAllAlerts(historyAlertData)


  }

  setStartEndIcon(longitude, latitude, type, popupData: VehicleOnMapDAO) {
    let iconFeature = new Feature({
      geometry: new Point(olProj.fromLonLat([Number(longitude), Number(latitude)])),
    })
    if (type == 'startpoint') {
      iconFeature.setStyle(this.historyStartPointStyle)
    }
    else {
      // if (!this.router.url.includes('/map/tripmap')) {
      iconFeature.setStyle(this.historyEndPointStyle);
      // }
    }

    iconFeature.setProperties({ properties: popupData })
    this.historyDirectionIconLayer.getSource().addFeatures([iconFeature]);
  }


  routeLineArray = [];


  setLiveRoute(coord, color) {
    let lastlocation = [];
    let currentLocation = [];
    if (coord.length > 1) {
      lastlocation = [Number(coord[coord.length - 2][0]), Number(coord[coord.length - 2][1])];
      currentLocation = [Number(coord[coord.length - 1][0]), Number(coord[coord.length - 1][1])]
    }
    if (lastlocation != currentLocation) {
      var lineString = new LineString(coord);
      lineString.transform('EPSG:4326', 'EPSG:3857');


      var lineStyle = new Style({
        fill: new Fill({
          color: '#0066ff',
          //  weight: 4
        }),
        stroke: new Stroke({
          color: color,
          width: 4
        })
      });

      var feature = new Feature({
        geometry: lineString
      });

      feature.setStyle(lineStyle);
      this.liveRouteLayer.getSource().addFeature(feature);



      // var sphere = new Sphere(6378137); 

      // var distance = sphere.haversineDistance(lastlocation, currentLocation);

      // var distanceInKm = distance / 1000;




    }
  }


  livevehicleOnMapInterval: any;
  zoomExtentFlag = true;
  imeino: string;


  livevehicleStyleFunction = (feature: FeatureLike, resolution: any): any => {
    // return new Style({
    //   image: new Icon({
    //     anchor: [0.5, 0.5],
    //     anchorXUnits: 'fraction',
    //     anchorYUnits: 'fraction',
    //     src: this.getVehicleIcon((feature.getProperties().properties as VehicleOnMapDAO).pollingstatus),// 'assets/mapimages/vehicleicon.png',
    //     scale: (1 / Math.pow(resolution, 1 / 4) < 0.8000) ? 0.8 : (1 / Math.pow(resolution, 1 / 4)),
    //     rotateWithView: true,
    //     rotation: Number((feature.getProperties().properties as VehicleOnMapDAO).vehicledirection) * ((Math.PI) / 180)
    //     // rotation: Number((feature.getProperties()['properties'] as VehicleOnMapDAO).vehicledirection) * ((Math.PI) / 180)
    //   }),
    //   text: new Text({
    //     text: (feature.getProperties()['properties'] as VehicleOnMapDAO).vehicleregno,
    //     offsetY: -20,
    //     fill: new Fill({
    //       color: '#000080'
    //     }),
    //     stroke: new Stroke({
    //       color: 'white',
    //       width: 1
    //     }),
    //     font: 'bold 10px serif'
    //   })
    // })
    let color: string = '';
    if (feature.getProperties().properties.pollingstatus.toLowerCase() == 'running') {
      color = '#009933'
    }
    else if (feature.getProperties().properties.pollingstatus.toLowerCase() == 'idle') {
      color = '#ffcc00'
    }
    else if (feature.getProperties().properties.pollingstatus.toLowerCase() == 'stop') {
      color = '#0066cc'
    }
    else if (feature.getProperties().properties.pollingstatus.toLowerCase() == 'non polling' || feature.getProperties().properties.pollingstatus.toLowerCase() == 'never polling') {
      color = '#ff0000'
    }
    else {
      color = '#ff0000'
    }

    if (feature.getProperties().properties.vehiclecategoryname.toLowerCase() == 'enforcement') {
      let style = new Style({
        image: new Icon({
          anchor: [0.5, 0.5],
          anchorXUnits: 'fraction',
          anchorYUnits: 'fraction',
          src: this.getVehicleIcon((feature.getProperties().properties as VehicleOnMapDAO).pollingstatus, feature.getProperties().properties.vehiclecategoryname),// 'assets/mapimages/vehicleicon.png',
          scale: (1 / Math.pow(resolution, 1 / 4) < 0.8000) ? 0.8 : (1 / Math.pow(resolution, 1 / 4)),
          rotateWithView: true,
          rotation: Number((feature.getProperties().properties as VehicleOnMapDAO).vehicledirection) * ((Math.PI) / 180),
          // rotation: Number((feature.getProperties()['properties'] as VehicleOnMapDAO).vehicledirection) * ((Math.PI) / 180)
          color: color
        }),
        text: new Text({
          text: (feature.getProperties()['properties'] as VehicleOnMapDAO).vehicleregno,
          offsetY: -20,
          fill: new Fill({
            color: '#000080'
          }),
          stroke: new Stroke({
            color: 'white',
            width: 1
          }),
          font: 'bold 10px serif'
        })
      })

      return style;
    }
    else {

      return new Style({
        image: new CircleStyle({
          radius: 8,
          fill: new Fill({ color: color }),
          stroke: new Stroke({
            color: 'black',
            width: 2,
          }),
        }),
        text: new Text({
          text: (feature.getProperties()['properties'] as VehicleOnMapDAO).vehicleregno,
          offsetY: -20,
          fill: new Fill({
            color: '#000080'
          }),
          stroke: new Stroke({
            color: 'white',
            width: 2
          }),
          font: 'bold 10px serif'
        }),
      })
    }
  }




  setLiveVehicleIcon(popupData: VehicleOnMapDAO) {

    let iconFeature = new Feature({
      geometry: new Point(olProj.fromLonLat([Number(popupData.longitude), Number(popupData.latitude)]))
    });
    iconFeature.setProperties({ properties: popupData })

    // let iconStyle = new Style({
    //   image: new Icon({
    //     anchor: [0.5, 25],
    //     anchorXUnits: 'fraction',
    //     anchorYUnits: 'pixels',
    //     src: this.getVehicleIcon(popupData.pollingstatus),
    //     scale: 1,
    //     rotation: Number((+(popupData.vehicledirection) * Math.PI) / 180.0),
    //     rotateWithView: true
    //   }),

    //   text: new Text({
    //     text: popupData.vehicleregno,
    //     offsetY: -20,
    //     fill: new Fill({
    //       color: '#000080'
    //     }),
    //     stroke: new Stroke({
    //       color: 'white',
    //       width: 1
    //     }),
    //     font: 'bold 12px serif'
    //   })
    // })
    iconFeature.setStyle(this.livevehicleStyleFunction);
    try { this.liveVehicleIconLayer.getSource().clear() } catch (e) { }




    this.liveVehicleIconLayer.getSource().addFeatures([iconFeature])

    // if (this.router.url != '/alerts/sosevent') {
    if (this.liveroutedata.length == 1) {
      try {
        this.view.animate({
          center: olProj.fromLonLat([Number(popupData.longitude), Number(popupData.latitude)]),
          duration: 500,
          zoom: 15,
        });
      } catch (e) { console.warn(e) }
    }
    // }
    // else {
    //   try {
    //     if (this.zoomExtentFlag) {
    //       this.view.animate({
    //         center: olProj.fromLonLat([Number(longitude), Number(lattitude)]),
    //         duration: 500,
    //       });
    //     }
    //     else {

    //     }
    //   } catch (e) { console.warn('in another', e) }
    // }
  }


  liveDirectionStyleFunction = (feature: FeatureLike, resolution: any): any => {
    return new Style({
      image: new Icon({
        anchor: [0.5, 0.5],
        anchorXUnits: 'fraction',
        anchorYUnits: 'fraction',
        src: 'assets/mapimages/directionicon/up-arrow.png',
        scale: (1 / Math.pow(resolution, 1 / 4) >= 0.8000) ? 0.8 : (1 / Math.pow(resolution, 1 / 4)),
        // scale: (1 / Math.pow(resolution, 1 / 4)),
        rotateWithView: true,
        rotation: Number(feature.getProperties()['properties'].vehicledirection) * ((Math.PI) / 180),
      })
    })
  }


  setLiveDirectionIcon(vehicleonMap: VehicleOnMapDAO) {
    let iconFeature = new Feature({
      geometry: new Point(olProj.fromLonLat([Number(vehicleonMap.longitude), Number(vehicleonMap.latitude)])),
    });

    // let iconStyle = new Style({
    //   image: new Icon({
    //     anchor: [0.5, 5],
    //     anchorXUnits: 'fraction',
    //     anchorYUnits: 'pixels',
    //     src: "assets/mapimages/directionicon/up-arrow.png",
    //     scale: 0.8,
    //     rotation: Number((+(vehicleonMap.vehicledirection) * Math.PI) / 180.0),
    //     rotateWithView: true
    //   })
    // })

    // iconFeature.setStyle(iconStyle);
    iconFeature.setStyle(this.liveDirectionStyleFunction)
    iconFeature.setProperties({ properties: vehicleonMap })
    this.livedirectionIconLayer.getSource().addFeatures([iconFeature]);
  }



  // cluster plotting functionality
  // date : 26 july 2023

  maxFeatureCount: number = 0;
  currentResolution: any;

  calculateClusterInfo = (resolution: any) => {
    this.maxFeatureCount = 0;
    var features = this.clusterLayer.getSource()?.getFeatures();
    let feature, radius;
    for (let i = features!.length - 1; i >= 0; --i) {
      feature = features![i];
      const originalFeatures = feature.get('features');
      var extent = createEmpty();
      let j, jj;
      for (j = 0, jj = originalFeatures.length; j < jj; ++j) {
        extend(extent, originalFeatures[j].getGeometry().getExtent());
      }

      this.maxFeatureCount = Math.max(this.maxFeatureCount, jj);
      radius = (0.25 * (getWidth(extent) + getHeight(extent))) / resolution;
      feature.set('radius', radius < 19 ? 10 : radius);
    }
  };



  createClusterIconStyle(feature: FeatureLike) {


    let pollingstatus: string = feature.getProperties().properties.pollingstatus;
    let vehicleCategoryName: string = feature.getProperties().properties.vehiclecategoryname;

    // let style = new Style({
    //   image: new Icon(({
    //     anchor: [0.5, 0.5],
    //     scale: (1 / Math.pow(this.currentResolution, 1 / 4)) < 0.8 ? 0.8 : (1 / Math.pow(this.currentResolution, 1 / 4)),
    //     // scale: 0.2,
    //     anchorXUnits: 'fraction',
    //     anchorYUnits: 'fraction',
    //     src: this.getVehicleIcon(pollingstatus, vehicleCategoryName),// 'assets/mapimages/vehicleicon.png',
    //     rotation: +(feature.getProperties()['properties'] as VehicleOnMapDAO).vehicledirection * (Math.PI / 180),
    //     rotateWithView: true,
    //   })),

    //   text: new Text({
    //     text: (feature.getProperties()['properties'] as VehicleOnMapDAO).vehicleregno,
    //     // offsetY: -20,
    //     fill: new Fill({
    //       color: '#000080'
    //     }),
    //     stroke: new Stroke({
    //       color: 'white',
    //       width: 1
    //     }),
    //     font: 'bold 10px serif',
    //     rotateWithView: false,
    //     rotation: +feature.getProperties()['properties'].vehicleDirection > 320 ? 360 + Number(feature.getProperties()['properties'].vehicleDirection) : Number(feature.getProperties()['properties'].vehicleDirection),
    //   })
    // });
    // return style
    let color: string = '';
    if (feature.getProperties().properties.pollingstatus.toLowerCase() == 'running') {
      color = '#009933'
    }
    else if (feature.getProperties().properties.pollingstatus.toLowerCase() == 'idle') {
      color = '#ffcc00'
    }
    else if (feature.getProperties().properties.pollingstatus.toLowerCase() == 'stop') {
      color = '#0066cc'
    }
    else if (feature.getProperties().properties.pollingstatus.toLowerCase() == 'non polling' || feature.getProperties().properties.pollingstatus.toLowerCase() == 'never polling') {
      color = '#ff0000'
    }

    if (feature.getProperties().properties.vehiclecategoryname.toLowerCase() == 'enforcement') {
      let style = new Style({
        image: new Icon(({
          anchor: [0.5, 0.5],
          scale: (1 / Math.pow(this.currentResolution, 1 / 4)) < 0.8 ? 0.8 : (1 / Math.pow(this.currentResolution, 1 / 4)),
          anchorXUnits: 'fraction',
          anchorYUnits: 'fraction',
          src: this.getVehicleIcon(feature.getProperties().properties.pollingstatus, feature.getProperties().properties.vehiclecategoryname),// 'assets/mapimages/vehicleicon.png',
          rotation: +(feature.getProperties()['properties'] as VehicleOnMapDAO).vehicledirection * (Math.PI / 180),
          rotateWithView: true,
          color: color
        })),
        text: new Text({
          text: (feature.getProperties()['properties'] as VehicleOnMapDAO).vehicleregno,
          offsetY: -20,
          fill: new Fill({
            color: '#000000'
          }),
          stroke: new Stroke({
            color: 'white',
            width: 1
          }),
          font: 'bold 10px serif',
          rotateWithView: false,
          // rotation: +feature.getProperties()['properties'].vehicleDirection > 320 ? 360 + Number(feature.getProperties()['properties'].vehicleDirection) : Number(feature.getProperties()['properties'].vehicleDirection),
        })
      })
      return style
    }
    else {
      return new Style({
        image: new CircleStyle({
          radius: 6,
          fill: new Fill({ color: color }),
          stroke: new Stroke({
            color: 'black',
            width: 2,
          }),
        }),
        text: new Text({
          text: (feature.getProperties()['properties'] as VehicleOnMapDAO).vehicleregno,
          offsetY: -20,
          fill: new Fill({
            color: '#000080'
          }),
          stroke: new Stroke({
            color: 'white',
            width: 2
          }),
          font: 'bold 10px serif'
        }),
      })
    }

  }
  selectedVehicleType: string = "";
  plotCluster = (clusterData: VehicleOnMapDAO[]): void => {
    if (this.router.url != '/map/mapsearch' && this.router.url != '/map/enforcementtracking' && this.router.url != '/dashboard/enforcement' && this.router.url! + '/map/maptracking') {
      this.clearAllLayers()
    }

    var features = new Array(clusterData.length);
    for (var i = 0; i < clusterData.length; i++) {
      clusterData[i].trackingtype = 'cluster';

      features[i] = new Feature(new Point(olProj.fromLonLat([+clusterData[i].longitude, +clusterData[i].latitude])));
      features[i].setProperties({ properties: clusterData[i] })
    }
    this.clusterLayer.getSource().getSource().clear();
    this.clusterLayer.getSource()?.getSource()?.addFeatures(features);
    this.clusterLayer.setStyle(this.clusterSyleFunction)
    this.map.updateSize();
  }


  getVehicleIcon(pollingstatus: string, vehicleCategoryName: string) {
    let vehicleicon: string = "";
    if (vehicleCategoryName == 'Bus') {
      if (pollingstatus.toLowerCase() == 'non polling') {
        vehicleicon = 'assets/mapimages/vehicleicon/bus-red.png'
      }
      else if (pollingstatus.toLowerCase() == 'running') {
        vehicleicon = 'assets/mapimages/vehicleicon/bus-green.png'
      }
      else if (pollingstatus.toLowerCase() == 'idle') {
        vehicleicon = 'assets/mapimages/vehicleicon/bus-yellow.png'
      }
      else if (pollingstatus.toLowerCase() == 'stop') {
        vehicleicon = 'assets/mapimages/vehicleicon/bus-blue.png'
      }
      else {
        vehicleicon = 'assets/mapimages/vehicleicon/bus-yellow.png'
      }
    }
    if (vehicleCategoryName == 'Enforcement' && (this.selectedVehicleType && this.selectedVehicleType.toLowerCase() == 'buses')) {
      vehicleicon = 'assets/mapimages/vehicleicon/enforcement-gary-dot.png'
    }
    else if (vehicleCategoryName.toLowerCase() == 'enforcement' && (this.selectedVehicleType && (this.selectedVehicleType.toLowerCase() == 'enforcementvehicle' || this.selectedVehicleType.toLowerCase() == 'both'))) {
      if (pollingstatus.toLowerCase() == 'non polling') {
        vehicleicon = 'assets/mapimages/vehicleicon/enforcement.png'
      }
      else if (pollingstatus.toLowerCase() == 'running') {
        vehicleicon = 'assets/mapimages/vehicleicon/enforcement.png'
      }
      else if (pollingstatus.toLowerCase() == 'idle') {
        vehicleicon = 'assets/mapimages/vehicleicon/enforcement.png'
      }
      else if (pollingstatus.toLowerCase() == 'stop') {
        vehicleicon = 'assets/mapimages/vehicleicon/enforcement.png'
      }
    }
    else {
      vehicleicon = 'assets/mapimages/vehicleicon/enforcement.png'
    }

    return vehicleicon
  }


  poiStyleFunction = (feature: FeatureLike, resolution: any): any => {
    var scale = 100 / (this.map.getView().getResolution() as any);

    if (this.map.getView().getZoom() > 12) {

      let style = new Style({
        image: new Icon({
          anchor: [0.5, 1],
          anchorXUnits: 'fraction',
          anchorYUnits: 'fraction',
          src: 'assets/mapimages/poiicon/busstop.png',
          // scale: (1 / Math.pow(resolution, 1 / 4))
          scale: (1 / Math.pow(resolution, 1 / 4) <= 0.7000) ? 0.7 : (1 / Math.pow(resolution, 1 / 4)),
          // rotateWithView: true,
          // rotation: Number(feature.getProperties()['properties'].vehicledirection) * ((Math.PI) / 180)
        }),
        text: new Text({
          text: this.truncatePipe.transform((feature.getProperties().properties as GeomDetails).geomname, 10),
          font: "bold 9px serif",
          fill: new Fill({
            color: '#000',
          }),
          stroke: new Stroke({
            width: 5,
            color: '#fff'
          }),
          offsetY: 1
        }),
      })

      var circleStyle = new Style({
        image: new CircleStyle({
          // radius: 5, // Set the radius of the circle
          radius: scale, // Set the radius of the circle
          fill: new Fill({
            color: '#00000024' // Set the fill color of the circle
          }),
          stroke: new Stroke({
            color: 'black'
          })
        })
      });


      return this.router.url == '/report/inoutreport' ? style : [circleStyle, style]
    }
    else {
      let style = new Style({
        image: new Icon({
          anchor: [0.5, 1],
          anchorXUnits: 'fraction',
          anchorYUnits: 'fraction',
          src: 'assets/mapimages/poiicon/busstop.png',
          // scale: (1 / Math.pow(resolution, 1 / 4))
          scale: (1 / Math.pow(resolution, 1 / 4) <= 0.7000) ? 0.7 : (1 / Math.pow(resolution, 1 / 4)),
          // rotateWithView: true,
          // rotation: Number(feature.getProperties()['properties'].vehicledirection) * ((Math.PI) / 180)
        }),
      })

      var circleStyle = new Style({
        image: new CircleStyle({
          // radius: 5, // Set the radius of the circle
          radius: scale, // Set the radius of the circle
          fill: new Fill({
            color: '#00000024' // Set the fill color of the circle
          }),
          stroke: new Stroke({
            color: 'black'
          })
        })
      });
      // return style
      return this.router.url == '/report/inoutreport' ? style : [circleStyle, style]

    }
  }


  BusStopStyleFunction = (feature: FeatureLike, resolution: any): any => {

    var scale = 100 / (this.map.getView().getResolution() as any);
    if (this.map.getView().getZoom() > 12) {

      let iconStyle = new Style({
        image: new Icon({
          anchor: [0.5, 1],
          anchorXUnits: 'fraction',
          anchorYUnits: 'fraction',
          src: "assets/mapimages/poiicon/busstop.png",
          scale: (1 / Math.pow(resolution, 1 / 4) <= 0.7000) ? 0.7 : (1 / Math.pow(resolution, 1 / 4)),
          rotateWithView: true,
          // color: 'red'
        }),
        text: new Text({
          text: this.truncatePipe.transform((feature.getProperties().properties as GeomDetails).geomname, 10),
          offsetY: 1,
          fill: new Fill({
            color: '#000080'
          }),
          stroke: new Stroke({
            color: 'white',
            width: 2
          }),
          font: 'bold 10px arial'
        }),
      })
      // Create a circle style
      var circleStyle = new Style({
        image: new CircleStyle({
          // radius: 5, // Set the radius of the circle
          radius: scale, // Set the radius of the circle
          fill: new Fill({
            color: '#00000024' // Set the fill color of the circle
          }),
          stroke: new Stroke({
            color: 'black'
          })
        })
      });
      return [circleStyle, iconStyle]
    }
    else {
      let iconStyle = new Style({
        image: new Icon({
          anchor: [0.5, 1],
          anchorXUnits: 'fraction',
          anchorYUnits: 'fraction',
          src: "assets/mapimages/poiicon/busstop.png",
          scale: (1 / Math.pow(resolution, 1 / 4) <= 0.7000) ? 0.7 : (1 / Math.pow(resolution, 1 / 4)),
          // color: 'red'
        }),

      })
      // Create a circle style
      var circleStyle = new Style({
        image: new CircleStyle({
          // radius: 5, // Set the radius of the circle
          radius: scale, // Set the radius of the circle
          fill: new Fill({
            color: '#00000024' // Set the fill color of the circle
          }),
          stroke: new Stroke({
            color: 'black'
          })
        })
      });
      return [circleStyle, iconStyle]
    }
  }


  geomDetails: GeomDetails[] = [];

  plotGeometry() {

    let geometryfeatures: Feature[] = [];
    for (let i = 0; i < this.geomDetails.length; i++) {
      // try {

      if (this.geomDetails[i].geomtypename.toLowerCase() == 'polygon') {

        let polygonGeometry = new Polygon(this.geomDetails[i].geomjson.geometry.coordinates)
        polygonGeometry.transform('EPSG:4326', 'EPSG:3857');
        let polygonFeature: Feature = new Feature({
          geometry: polygonGeometry
        })

        let polygonStyle = new Style({
          stroke: new Stroke({
            color: 'blue',
            lineDash: [4],
            width: 3,
          }),
          fill: new Fill({
            color: 'rgba(0, 0, 255, 0.1)',
          }),
          text: new Text({
            text: this.truncatePipe.transform(this.geomDetails[i].geomname, 5),
            offsetY: -20,
            fill: new Fill({
              color: '#000080'
            }),
            stroke: new Stroke({
              color: '#000000',
              width: 1
            }),
            font: '8px serif'
          })
        })
        polygonFeature.setStyle(polygonStyle);


        geometryfeatures.push(polygonFeature);
        // (this.geomDetails[i].geomjson?.geometry?.transform('EPSG:4326', 'EPSG:3857') as Polygon).getCoordinates
      }
      else if (this.geomDetails[i].geomtypename.toLowerCase() == 'linestring') {
        let lineString = new LineString(this.geomDetails[i].geomjson.geometry.coordinates);
        lineString.transform('EPSG:4326', 'EPSG:3857');

        let routeFeature = new Feature({
          geometry: lineString
        });
        var lineStyle = new Style({
          fill: new Fill({
            color: this.geomDetails[i].routecolor == '' || this.geomDetails[i].routecolor == '#000000' ? '#ffa500' : this.geomDetails[i].routecolor,
            //  weight: 4
          }),
          stroke: new Stroke({
            color: this.geomDetails[i].routecolor == '' || this.geomDetails[i].routecolor == '#000000' ? '#ffa500' : this.geomDetails[i].routecolor,
            width: 4
          }),
          // text: new Text({
          //   text: this.truncatePipe.transform(this.geomDetails[i].geomname, 5),
          //   offsetY: -20,
          //   fill: new Fill({
          //     color: '#000080'
          //   }),
          //   stroke: new Stroke({
          //     color: '#000000',
          //     width: 1
          //   }),
          //   font: 'bold 10px serif'
          // })
        });



        routeFeature.setStyle(lineStyle);
        routeFeature.setProperties(this.geomDetails[i]);
        geometryfeatures.push(routeFeature)

      }
      else if (this.geomDetails[i].geomtypename.toLowerCase() == 'point') {
        let pointFeature = new Feature({
          geometry: new Point(olProj.fromLonLat(this.geomDetails[i].geomjson.geometry.coordinates))
        })

        pointFeature.setStyle(this.poiStyleFunction);
        pointFeature.setProperties({ properties: this.geomDetails[i] as GeomDetails })

        geometryfeatures.push(pointFeature);

      }


      // } catch (error) { }

    }
    this.geometryLayer.getSource().clear();
    this.geometryLayer.getSource().addFeatures(geometryfeatures)
  }


  depotFlagStyleFunction = (feature: FeatureLike, resolution: any): any => {


    return new Style({
      image: new Icon({
        anchor: [0.5, 1],
        anchorXUnits: 'fraction',
        anchorYUnits: 'fraction',
        src: 'assets/mapimages/poiicon/busdepot.png',
        scale: (1 / Math.pow(resolution, 1 / 4) <= 0.7000) ? 0.7 : (1 / Math.pow(resolution, 1 / 4)),
        // rotateWithView: true,
        // rotation: Number(feature.getProperties()['properties'].vehicledirection) * ((Math.PI) / 180)
      }),
      // text: new Text({
      //   text: (feature.getProperties().properties as GeomDetails).depotname.substring(0, 10) + '...',
      //   font: "bold 11px serif",
      //   fill: new Fill({
      //     color: '#000',
      //   }),
      //   offsetY: 5
      // }),
    })
  }

  plotDepotByName = (depotname: string) => {
    var depotByNameSource = new TileWMS({
      url: 'http://vts.intaliatech.com/geoserver/RSRTC/wms',
      // url: "https://vts.intaliatech.com/geoserver/RSRTC/wms?service=WMS&version=1.1.0&request=GetMap&layers=RSRTC%3ADepotPolygon-polygon&bbox=71.4098181786324%2C23.0127233339558%2C77.4807740472418%2C29.9141828130225&width=675&height=768&srs=EPSG%3A4326&styles=&format=image/png&transparent=true",
      //  type: 'base',
      params: {
        'LAYERS': 'SRSTC:DepotPolygon-polygon',//'IndiaLayer',
        'TILED': true,
        'CRS': 'EPSG:4326',
        'STYLES': 'Depotbyname',
        'ENV': 'Name:' + depotname
      },
      serverType: 'geoserver',
      // tileGrid: tileGrid
    })

    this.busDepotByNameLayer.setSource(depotByNameSource)
  }


  plotDepotFlag = (depotDetails: DepotDetailResponse[]) => {

    this.clearAllLayers();
    let depotFeatures: Feature<Geometry>[] = [];
    for (let i = 0; i < depotDetails.length; i++) {
      if (depotDetails[i].longitude != '0.00000' && depotDetails[i].latitude != '0.00000') {
        // if (+depotDetails[i].longitude < 0 && +depotDetails[i].latitude < 0) {
        let depotFeature = new Feature({
          geometry: new Point(olProj.fromLonLat([+depotDetails[i].longitude, +depotDetails[i].latitude]))
        });


        let geom = new GeomDetails();

        geom.geomid = depotDetails[i].depotid;
        geom.geomname = depotDetails[i].depotname;
        geom.geomtypeid = 333;
        geom.geotypeid = 11
        geom.geotype = 'BUS DEPOT'
        this.geomDetails.push(geom)

        depotFeature.setStyle(this.depotFlagStyleFunction)
        depotFeature.setProperties({ properties: geom });

        depotFeatures.push(depotFeature)
      }
      else {
      }
    }
    this.geometryLayer.getSource().addFeatures(depotFeatures);

    let olCoords = this.geometryLayer.getSource().getFeatures().map(x => (x.getGeometry() as Point).getCoordinates());
    const extent = boundingExtent(olCoords);
    try {
      this.map.getView().fit(extent, { duration: 1000, padding: [50, 50, 50, 50] });
    } catch (error) { }


  }

  // alert plotting starts 
  // developer : dhammadeep dahiwale



  SOSStyleFunction = (feature: FeatureLike, resolution: any): any => {
    let featureText: string = feature.getProperties().properties.vehicleregno + '\n' + this.datePipe.transform(feature.getProperties().properties.alerttime, 'dd-MMM-yyyy') + '\n' + this.datePipe.transform(feature.getProperties().properties.alerttime, 'hh:mm a');

    if (1 / Math.pow(resolution, 1 / 4) >= 0.3) {
      return new Style({
        image: new Icon({
          anchor: [0.5, 1],
          anchorXUnits: 'fraction',
          anchorYUnits: 'fraction',
          src: 'assets/mapimages/sos.png',
          scale: (1 / Math.pow(resolution, 1 / 4)) > 1 ? 1.00 : (1 / Math.pow(resolution, 1 / 4) < 0.5 ? 0.5 : (1 / Math.pow(resolution, 1 / 4))),
          // scale: (1 / Math.pow(resolution, 1 / 4) < 0.7000) ? 0.7 : (1 / Math.pow(resolution, 1 / 4)),
        }),
        text: new Text({
          // text: feature.getProperties().properties.vehicleregno,
          text: featureText,
          offsetY: 15,
          fill: new Fill({
            color: '#000000'
          }),
          stroke: new Stroke({
            color: '#ffffff',
            width: 3
          }),
          font: 'bold 10px serif',
        })
      });
    }
    else {
      return new Style({
        image: new Icon({
          anchor: [0.5, 1],
          anchorXUnits: 'fraction',
          anchorYUnits: 'fraction',
          src: 'assets/mapimages/sos.png',
          scale: (1 / Math.pow(resolution, 1 / 4)) > 1 ? 1.00 : (1 / Math.pow(resolution, 1 / 4) < 0.6 ? 0.6 : (1 / Math.pow(resolution, 1 / 4))),
          // scale: (1 / Math.pow(resolution, 1 / 4) < 0.7000) ? 0.7 : (1 / Math.pow(resolution, 1 / 4)),
        }),
      })
    }
  }


  plotSOSAlerts(sosDetails: SOSDetails[], type?: string) {
    let sosFeatures = []
    for (let i = 0; i < sosDetails.length; i++) {
      // for (let i = 0; i < 1; i++) {
      let iconFeature = new Feature({
        geometry: new Point(olProj.fromLonLat([Number(sosDetails[i].longitude), Number(sosDetails[i].lattitude)]))
      })

      let iconFeaturePoperty = {
        properties: sosDetails[i]
      }
      iconFeature.setProperties(iconFeaturePoperty)

      let iconText: string = sosDetails[i].vehicleregno + '\n' + this.datePipe.transform(sosDetails[i].alerttime, 'dd-MMM-yyyy') + '\n' + this.datePipe.transform(sosDetails[i].alerttime, 'hh:mm a');

      const gifUrl = 'assets/mapimages/sos1.gif';
      const gif = gifler(gifUrl);
      gif.frames(document.createElement('canvas'), (ctx: CanvasRenderingContext2D, frame) => {
        if (!iconFeature.getStyle()) {
          iconFeature.setStyle(
            new Style({
              image: new Icon({
                img: ctx.canvas,
                imgSize: [50, 50],
                scale: 0.6,
                anchor: [0.5, 0.5],
                anchorXUnits: 'fraction',
                anchorYUnits: 'fraction',
              }),
              text: new Text({
                text: iconText,
                offsetY: 20,
                fill: new Fill({
                  color: '#000000'
                }),
                stroke: new Stroke({
                  color: 'white',
                  width: 1
                }),
                font: 'bold 8px serif'
              })
            })
          );
        }
        ctx.clearRect(0, 0, frame.width, frame.height);
        ctx.drawImage(frame.buffer, frame.x, frame.y);
        this.map.render();
      },
        true
      );

      //  iconFeature.setStyle(this.SOSStyleFunction);
      // iconFeature.setStyle(this.setSOSStyle)
      try { this.alertLayer.getSource().clear() } catch (e) { }
      sosFeatures.push(iconFeature);
    }
    this.alertLayer.getSource().addFeatures(sosFeatures);


    let olCoords = sosDetails.map(x => olProj.fromLonLat([+x.longitude, +x.lattitude]))
    const extent = boundingExtent(olCoords);

    if (type != 'single') {
      try {
        this.map.getView().fit(extent, { duration: 200, padding: [100, 100, 100, 300] });
      } catch (error) { }
    }
  }

  setSOSStyle = (feature: FeatureLike, resolution: any): any => {
    let style: any
    const gifUrl = 'assets/mapimages/sos1.gif';
    const gif = gifler(gifUrl);
    gif.frames(document.createElement('canvas'), (ctx: CanvasRenderingContext2D, frame) => {
      // if (!feature.getStyleFunction()) {
      // .setStyle(
      style = new Style({
        image: new Icon({
          img: ctx.canvas,
          imgSize: [50, 50],
          scale: 0.5,
          anchor: [0.5, 0.5],
          anchorXUnits: 'fraction',
          anchorYUnits: 'fraction',
        }),
      })


      // );
      // }
      ctx.clearRect(0, 0, frame.width, frame.height);
      ctx.drawImage(frame.buffer, frame.x, frame.y);
      this.map.render();

      return style
    }

      // true;
    )
    // retrun  style

  }




  AlertStyleFunction = (feature: FeatureLike, resolution: any): any => {
    let vehicleno = feature.getProperties().properties.vehicleno;
    let eventdate = this.datePipe.transform(feature.getProperties().properties.alerttime, 'dd-MMM-yyyy') + '\n' + this.datePipe.transform(feature.getProperties().properties.alerttime, 'hh:mm a')
    if ((1 / Math.pow(resolution, 1 / 4)) >= 0.6) {
      return new Style({
        image: new Icon({
          anchor: [0.5, 1],
          anchorXUnits: 'fraction',
          anchorYUnits: 'fraction',
          src: this.getAlertIcon(feature.getProperties().properties.alertname),
          scale: (1 / Math.pow(resolution, 1 / 4)) > 1 ? 1.00 : (1 / Math.pow(resolution, 1 / 4) < 0.7 ? 0.7 : (1 / Math.pow(resolution, 1 / 4))),
          // scale: (1 / Math.pow(resolution, 1 / 4) < 0.7000) ? 0.7 : (1 / Math.pow(resolution, 1 / 4)),
        }),
        text: new Text({
          // text: feature.getProperties().properties.alerttime,
          text: eventdate,
          // text : this.stringDivider( feature.getProperties().properties.vehicleno +'\n ' + feature.getProperties().properties.alerttime, 16, '\n'),
          offsetY: 10,
          fill: new Fill({
            color: '#000000'
          }),
          stroke: new Stroke({
            color: '#ffffff',
            width: 3
          }),
          font: 'bold 10px serif',
        })
      });
    }
    else {
      return new Style({
        image: new Icon({
          anchor: [0.5, 1],
          anchorXUnits: 'fraction',
          anchorYUnits: 'fraction',
          src: this.getAlertIcon(feature.getProperties().properties.alertname),
          scale: (1 / Math.pow(resolution, 1 / 4)) > 1 ? 1.00 : ((1 / Math.pow(resolution, 1 / 4) < 0.7) ? 0.7 : (1 / Math.pow(resolution, 1 / 4)))

          // scale: (1 / Math.pow(resolution, 1 / 4) < 0.7000) ? 0.7 : ((1 / Math.pow(resolution, 1 / 4) > 1.0000 ? 1.0 : (1 / Math.pow(resolution, 1 / 4))),
        }),
      })
    }
  }



  async plotAllAlerts(alertDetails: BusWiseAlertDetails[]) {
    let alertFeatures = [];
    for (let i = 0; i < alertDetails.length; i++) {
      let iconFeature = new Feature({
        geometry: new Point(olProj.fromLonLat([Number(alertDetails[i].flongitude), Number(alertDetails[i].flatitude)]))
      })

      iconFeature.setStyle(this.AlertStyleFunction)
      try { this.alertLayer.getSource().clear() } catch (e) { }

      let iconFeaturePoperty = {
        properties: alertDetails[i]
      }
      iconFeature.setProperties(iconFeaturePoperty)
      alertFeatures.push(iconFeature)
    }
    this.alertLayer.getSource().addFeatures(alertFeatures)

    if (this.router.url != '/map/maptracking' && this.router.url != '/operation/livestatus') {
      let olCoords = alertDetails.map(x => olProj.fromLonLat([+x.flongitude, +x.flatitude]))
      const extent = boundingExtent(olCoords);
      try {
        this.map.getView().fit(extent, { duration: 1000, padding: [100, 100, 100, 300] });
      } catch (error) { }
    }
  }


  historyAlertDetails: BusWiseAlertDetails[] = [];
  plotAllHistoryAlerts = (alertDetails: BusWiseAlertDetails[]) => {
    let alertFeatures = [];
    for (let i = 0; i < alertDetails.length; i++) {
      let iconFeature = new Feature({
        geometry: new Point(olProj.fromLonLat([Number(alertDetails[i].flongitude), Number(alertDetails[i].flatitude)]))
      })


      iconFeature.setStyle(this.AlertPointStyle);
      try { this.alertLayer.getSource().clear() } catch (e) { }

      let iconFeaturePoperty = {
        properties: alertDetails[i]
      }
      iconFeature.setProperties(iconFeaturePoperty)
      alertFeatures.push(iconFeature)
    }
    this.alertLayer.getSource().addFeatures(alertFeatures)

    if (this.router.url != '/map/maptracking' && this.router.url != '/operation/livestatus' &&
      !this.router.url.includes('/map/tripmap') && this.router.url != '/report/distancetravelledreport'
      && this.router.url != '/report/depotoutreport' && this.router.url != '/report/dutyreport') {
      let olCoords = alertDetails.map(x => olProj.fromLonLat([+x.flongitude, +x.flatitude]))
      const extent = boundingExtent(olCoords);
      try {
        this.map.getView().fit(extent, { duration: 1000, padding: [50, 50, 100, 300] });
      } catch (error) { }
    }
  }




  setVehicleStatusColor = (pollingstatus: string): string => {
    if (pollingstatus.toLowerCase() == 'running') {
      return 'lightgreen'
    }
    else if (pollingstatus.toLowerCase() == 'idle') {
      return '#ffff56'
    }
    else if (pollingstatus.toLowerCase() == 'stop') {
      return '#bcbcff'

    }
    else if (pollingstatus.toLowerCase() == 'non polling') {
      return '#ff8d8d'
    }
  }



  // live  vehicle tracking without haderkey 
  // tracking by passenger for vehicle live status using token 

  token: string = '';
  pnrno: string = "";
  trackBooking(token: string) {
    let livestatusReq = new LiveStatus_DetailsReq()
    this.liveDistance = 0;
    this.token = token;

    this.apiService.trackBooking(token).subscribe((response: any) => {
      if (response.producerstatuscode == 200) {
        let liveData: VehicleOnMapDAO = response.producerresponse.livevehicledetails[0];
        this.selectedVehicleOnMap = this.popupData ? this.popupData : liveData;

        liveData.speed = +liveData.speed;

        this.popupData = liveData;
        this.popupData.trackingtype = 'live';
        if (this.popupData.routename && this.popupData.serviceno) {
          this.plotDutyStoppagesForPNR(this.popupData.serviceno, this.popupData.vehicleid, this.popupData['dutydate']);
          this.plotDutyStoppagesForPNRNumber();
        }
        this.liveroutedata.push([Number(liveData.longitude), Number(liveData.latitude)]);
        if (this.liveroutedata.length == 1) {
          if (this.popupData.routename && this.popupData.serviceno) {
            this.plotDefinedRouteForPNR(this.popupData.routename);
          }
          this.setLiveDirectionIcon(this.popupData);
          this.setLiveVehicleIcon(this.popupData);
          this.livevehicleOnMapInterval = setTimeout(() => {
            this.trackBooking(token);
          }, 10000);
        }
        // this.setLiveRoute(this.liveroutedata, 'green');
        try {
          if (this.liveroutedata.length >= 2) {
            let linecoordinate = [this.liveroutedata[this.liveroutedata.length - 2], this.liveroutedata[this.liveroutedata.length - 1]]
            this.liveDistance = 0;
            this.liveLastTime = new Date()

            this.currentRoute = new LineString(linecoordinate)
            this.currentRoute.transform('EPSG:4326', 'EPSG:3857');
            this.liveVehicleIconLayer.setVisible(false)
            this.livedirectionIconLayer.on('postrender', this.animateLiveVehicleForBooking);
            this.map.getView().animate({
              center: olProj.fromLonLat([+liveData.longitude, +liveData.latitude])
            })
          }


          this.map.getView().animate({
            center: olProj.fromLonLat([+liveData.longitude, +liveData.latitude])
          })




        } catch (error) { }

      }
      else {
      }
    }, (err) => {
      //ErrorAlert(err.message);
    })
  }


  // booking tracking forpassenger
  animateBooking = (event: any): void => {
    const speed = 100;
    const time = event.frameState.time;
    const elapsedTime = time - this.liveLastTime;
    this.liveDistance = (this.liveDistance + (speed * elapsedTime) / 1e6) % 2;
    this.liveLastTime = time;


    const currentCoordinate = this.currentRoute.getCoordinateAt(
      this.liveDistance > 1 ? 2 - this.liveDistance : this.liveDistance
    );

    // for vehicle animation 

    // this.liveVehicleIconLayer.getSource().getFeatures()[0].setProperties({ properties: this.selectedVehicleOnMap })
    // this.liveVehicleIconLayer.getSource().getFeatures()[0].setStyle(this.historyvehicleStyleFunction);
    // (this.liveVehicleIconLayer.getSource().getFeatures()[0].getGeometry() as Point).setCoordinates(currentCoordinate)

    let position: any = this.liveVehicleIconLayer.getSource().getFeatures()[0].getGeometry().clone();
    position.setCoordinates(currentCoordinate);
    const vectorContext = getVectorContext(event);

    let style = new Style({
      image: new Icon({
        anchor: [0.5, 0.5],
        anchorXUnits: 'fraction',
        anchorYUnits: 'fraction',
        src: this.getVehicleIcon(this.popupData.pollingstatus, 'bus'),// 'assets/mapimages/vehicleicon.png',
        // scale: (1 / Math.pow(resolution, 1 / 4) < 0.8000) ? 0.8 : (1 / Math.pow(resolution, 1 / 4)),
        rotateWithView: true,
        rotation: Number(this.selectedVehicleOnMap.vehicledirection) * ((Math.PI) / 180)
      }),
      text: new Text({
        text: this.popupData.vehicleregno,
        offsetY: -20,
        fill: new Fill({
          color: '#000080'
        }),
        stroke: new Stroke({
          color: 'white',
          width: 1
        }),
        font: 'bold 10px serif'
      })
    })
    vectorContext.setStyle(style);
    vectorContext.drawGeometry(position);



    // for route animation
    this.currentRouteCoordinates.push(currentCoordinate);
    var lineStyle = new Style({
      fill: new Fill({
        color: '#000000',
      }),
      stroke: new Stroke({
        color: '#0066ff',
        width: 3,
      })
    });

    let liveRouteFeature = new Feature({
      geometry: new LineString(this.currentRouteCoordinates)
    })

    liveRouteFeature.setStyle(lineStyle);
    liveRouteFeature.setProperties({ properties: this.selectedVehicleOnMap });
    this.liveRouteLayer.getSource().clear();
    this.liveRouteLayer.getSource().addFeature(liveRouteFeature);

    // // for route animation
    // tell OpenLayers to continue the postrender animation
    this.map.render();
    this.map.updateSize();

    if (this.liveDistance >= 0.999) {
      this.livedirectionIconLayer.un('postrender', this.animateBooking);
      this.setLiveVehicleIcon(this.popupData);
      this.liveVehicleIconLayer.setVisible(true)
      this.setLiveDirectionIcon(this.popupData);
      this.trackBooking(this.token);

    }
  }



  getAlertIcon(alertname: string) {
    let alertimage: string = 'assets/mapimages/alerticon/';
    switch (alertname.toLowerCase()) {
      case "device tampered":
        return alertimage + 'alert.png'
      case "gps box opened":
        return (alertimage + "gpsboxopened.png");
      case "harsh acceleration":
        return alertimage + 'alert.png'
      case "harsh braking":
        return alertimage + 'harshbrake.png'
      case "ignition off":
        return alertimage + "igoff.png"
      case "ignition on":
        return alertimage + "igon.png"
      case "in shed depot":
        return alertimage + 'inside.png'
      case "inside bus stop":
        return alertimage + 'inside.png'
      case "internal battery charged":
        return alertimage + 'batterycharged.png'
      case "internal battery low":
        return alertimage + 'batterylow.png'
      case "main battery reconnect":
        return alertimage + "batteryreconnect.png";
      case "main battery disconnect":
        return alertimage + 'batterydisconnect.png'
      case "normal ":
        return alertimage + 'alert.png'
      case "out depot":
        return alertimage + 'outside.png'
      case "out shed depot":
        return alertimage + 'outside.png'
      case "outside bus stop":
        return alertimage + 'outside.png'
      case "over the air (ota)":
        return alertimage + 'alert.png'
      case "overspeed":
        return alertimage + "overspeed.png";
      case "rash turning":
        return alertimage + "rashturning.png";
      case "route deviation end":
        return alertimage + 'alert.png'
      case "route deviation start":
        return alertimage + 'alert.png'
      case "sos auto off":
        return alertimage + 'sosoff.png'
      case "sos press":
        return alertimage + "sos.png"
      default:
        return alertimage + 'alert.png'



    }


  }

  duration: number = 3000;
  // start = Date.now();
  // listenerKey: any;//= this.alertLayer.on('postrender', this.animate);
  // flashGeom: Geometry;



  flash(feature: Feature) {
    let flashListIndex = this.flashList.findIndex(x => x.rowno === feature.getProperties().properties.rowno);
    // this.start = Date.now();
    // this.flashGeom = feature.getGeometry().clone();
    // this.listenerKey = this.alertLayer.on('postrender', this.animate);

    this.flashList[flashListIndex].start = Date.now();
    this.flashList[flashListIndex].flashGoem = feature.getGeometry().clone();
    this.flashList[flashListIndex].listenerKey = this.alertLayer.on('postrender', this.animate);

  }

  animate = (event: any): any => {

    let flashIndex: number;
    flashIndex = (event.target as VectorLayer<VectorSource>).getSource().getFeatures().findIndex(x => x.getProperties().properties.start);
    const frameState = event.frameState;
    // const elapsed = frameState.time - this.start;
    const elapsed = frameState.time - this.flashList[flashIndex].start;


    // if (elapsed >= this.duration) {
    //   // unByKey(this.listenerKey);
    //   unByKey(this.flashList[flashIndex].listenerKey);
    //   return;
    // }
    // const vectorContext = getVectorContext(event);
    // const elapsedRatio = elapsed / this.duration;
    // // radius will be 5 at start and 30 at end.
    // const radius = easeOut(elapsedRatio) * 25 + 5;
    // const opacity = easeOut(1 - elapsedRatio);

    // const style = new Style({
    //   image: new CircleStyle({
    //     radius: radius,
    //     stroke: new Stroke({
    //       color: 'rgba(255, 0, 0, ' + opacity + ')',
    //       width: 0.25 + opacity,
    //     }),
    //   }),
    // });

    // vectorContext.setStyle(style);
    // // vectorContext.drawGeometry(this.flashGeom);
    // vectorContext.drawGeometry(this.flashList[flashIndex].flashGeom);





    // tell OpenLayers to continue postrender animation

    this.map.render();

  }


  stringDivider(str, width, spaceReplacer) {
    if (str.length > width) {
      let p = width;
      while (p > 0 && str[p] != ' ' && str[p] != '-') {
        p--;
      }
      if (p > 0) {
        let left;
        if (str.substring(p, p + 1) == '-') {
          left = str.substring(0, p + 1);
        } else {
          left = str.substring(0, p);
        }
        const right = str.substring(p + 1);
        return left + spaceReplacer + this.stringDivider(right, width, spaceReplacer);
      }
    }
    return str;
  }



  toggleAlertFeature(item: { alertid: string, alertname: string, alertcount: number }) {
    let historyAlertDetails: BusWiseAlertDetails[] = [];
    for (let i = 0; i < this.historyAlertList.length; i++) {
      if (this.historyAlertList[i].visible) {
        for (let j = 0; j < this.historyAlertDetails.length; j++) {
          if (this.historyAlertList[i].alertname.toLowerCase() === this.historyAlertDetails[j].alertname.toLowerCase()) {
            historyAlertDetails.push(this.historyAlertDetails[j])
          }
        }
      }
    }
    this.alertLayer.getSource().clear();
    this.plotAllHistoryAlerts(historyAlertDetails)

  }


  dutyStoppageStyleFunction = (feature: FeatureLike, resolution: any): any => {
    let color: any = undefined
    if (feature.getProperties()['properties'].stopcode && (feature.getProperties()['properties'].stopcode == this.dutyStoppageWithPNRData.boardingstopcode)) {

      color = '#009933';

    }
    else if (feature.getProperties()['properties'].stopcode && (feature.getProperties()['properties'].stopcode == this.dutyStoppageWithPNRData.destinationstopcode)) {
      color = '#e62e00';

    }

    else {
      color = undefined;
    }


    var scale = 100 / (this.map.getView().getResolution() as any);
    // if (this.map.getView().getZoom() > 12) {
    let stoppageStyle = new Style({
      image: new Icon({
        anchor: [0.5, 0.5],
        anchorXUnits: 'fraction',
        anchorYUnits: 'fraction',
        src: 'assets/mapimages/poiicon/busstop.png',
        scale: (1 / Math.pow(resolution, 1 / 4) <= 0.7000) ? 0.7 : (1 / Math.pow(resolution, 1 / 4)),
        // color: color,// this.router.url.includes('pnr') && (feature.getProperties()['properties'].stopcode == this.dutyStoppageWithPNRData.boardingstopcode) ? '#000000' : undefined
        color: color, // Use animated color

      }),
      text: new Text({
        text: feature.getProperties().properties.busstopname,
        font: "bold 10px serif",
        fill: new Fill({
          color: '#000',
        }),
        backgroundFill: new Fill({
          color: '#fff',
        }),

        offsetY: 20
      }),
    })



    var circleStyle = new Style({
      image: new CircleStyle({
        // radius: 5, // Set the radius of the circle
        radius: scale, // Set the radius of the circle
        fill: new Fill({
          color: '#00000024' // Set the fill color of the circle
        }),
        stroke: new Stroke({
          color: 'black'
        })
      })
    });

    return this.router.url == '/report/busstopreport' ? [circleStyle, stoppageStyle] : stoppageStyle
    // }
    // else {
    //   return new Style({
    //     image: new Icon({
    //       anchor: [0.5, 1],
    //       anchorXUnits: 'fraction',
    //       anchorYUnits: 'fraction',
    //       src: 'assets/mapimages/poiicon/busstop.png',
    //       scale: (1 / Math.pow(resolution, 1 / 4) <= 0.6000) ? 0.6 : (1 / Math.pow(resolution, 1 / 4)),
    //     }),
    //   })
    // }
  }


  dutySkipStoppageStyleFunction = (feature: FeatureLike, resolution: any): any => {
    // if (this.map.getView().getZoom() > 12) {
    return new Style({
      image: new Icon({
        anchor: [0.5, 0.5],
        anchorXUnits: 'fraction',
        anchorYUnits: 'fraction',
        src: 'assets/mapimages/poiicon/busstop1.png',
        // scale: (1 / Math.pow(resolution, 1 / 4))
        scale: (1 / Math.pow(resolution, 1 / 4) <= 0.7000) ? 0.7 : (1 / Math.pow(resolution, 1 / 4)),
        // rotateWithView: true,
        // rotation: Number(feature.getProperties()['properties'].vehicledirection) * ((Math.PI) / 180)
        // color: color, // Use animated color


      }),
      text: new Text({
        text: feature.getProperties().properties.busstopname,
        font: "bold 10px serif",
        fill: new Fill({
          color: '#000',
        }),
        backgroundFill: new Fill({
          color: '#fff',
        }),

        offsetY: 20
      }),
    })
    // }
    // else {
    //   return new Style({
    //     image: new Icon({
    //       anchor: [0.5, 1],
    //       anchorXUnits: 'fraction',
    //       anchorYUnits: 'fraction',
    //       src: 'assets/mapimages/poiicon/busstop.png',
    //       scale: (1 / Math.pow(resolution, 1 / 4) <= 0.6000) ? 0.6 : (1 / Math.pow(resolution, 1 / 4)),
    //     }),
    //   })
    // }
  }
  vehicleStoppedStyleFunction = (feature: FeatureLike, resolution: any): any => {
    // if (this.map.getView().getZoom() > 12) {
    return new Style({
      image: new Icon({
        anchor: [0.5, 0.5],
        anchorXUnits: 'fraction',
        anchorYUnits: 'fraction',
        src: 'assets/mapimages/alerticon/stop.png',
        // scale: (1 / Math.pow(resolution, 1 / 4))
        scale: (1 / Math.pow(resolution, 1 / 4) <= 0.7000) ? 0.7 : (1 / Math.pow(resolution, 1 / 4)),
        // rotateWithView: true,
        // rotation: Number(feature.getProperties()['properties'].vehicledirection) * ((Math.PI) / 180)
      }),
      text: new Text({
        text: feature.getProperties().properties.busstopname,
        font: "bold 10px serif",
        fill: new Fill({
          color: '#000',
        }),
        backgroundFill: new Fill({
          color: '#fff',
        }),

        offsetY: 20
      }),
    })
    // }
    // else {
    //   return new Style({
    //     image: new Icon({
    //       anchor: [0.5, 1],
    //       anchorXUnits: 'fraction',
    //       anchorYUnits: 'fraction',
    //       src: 'assets/mapimages/poiicon/busstop.png',
    //       scale: (1 / Math.pow(resolution, 1 / 4) <= 0.6000) ? 0.6 : (1 / Math.pow(resolution, 1 / 4)),
    //     }),
    //   })
    // }
  }


  plotDutyStoppage(dutyStoppageDetails: Dutystoppagedetail[]) {

    let stoppageFeatureList: Feature[] = [];
    for (let i = 0; i < dutyStoppageDetails.length; i++) {
      if (dutyStoppageDetails[i].longitude != '0.00000' && dutyStoppageDetails[i].latitude != '0.00000') {
        let stoppageFeature = new Feature({
          geometry: new Point(olProj.fromLonLat([+dutyStoppageDetails[i].longitude, +dutyStoppageDetails[i].latitude]))
        });
        stoppageFeature.setStyle(this.dutyStoppageStyleFunction)
        stoppageFeature.setProperties({ properties: dutyStoppageDetails[i] })
        stoppageFeatureList.push(stoppageFeature);
      }
    }
    this.geometryLayer.getSource().addFeatures(stoppageFeatureList)
  }


  dutyStoppageData: Dutystoppagedetail[] = [];
  dutyStoppageWithPNRData: DutystoppagedetailWithPNR = new DutystoppagedetailWithPNR();
  async plotDutyStoppages(serviceid: string, vehicleid: string, dutydate: string) {

    let dutyStoppageDetailsRequest: DutyStoppageDetailRequest = new DutyStoppageDetailRequest();
    dutyStoppageDetailsRequest.serviceid = serviceid;
    dutyStoppageDetailsRequest.vehicleidlist = [];
    dutyStoppageDetailsRequest.vehicleidlist.push(vehicleid);
    dutyStoppageDetailsRequest.dutydate = dutydate;


    return this.apiService.post(dutyStoppageDetailsRequest, APINAME.DUTY_STOPPAGE_DETAIL.replace('/', '')).subscribe(async (response: DutyStoppageDetailsResponse) => {
      if (response.producerstatuscode == 200) {
        let dutyStoppageDetailsResponse: DutyStoppageDetailsResponse = response as DutyStoppageDetailsResponse;
        this.dutyStoppageData = dutyStoppageDetailsResponse.producerresponse.dutystoppagedetail;
        let stoppageFeatureList: Feature<Geometry>[] = [];
        for (let i = 0; i < this.dutyStoppageData.length; i++) {
          if (this.dutyStoppageData[i].longitude != "0.00000" && this.dutyStoppageData[i].latitude != "0.00000") {
            let iconFeature = new Feature({
              geometry: new Point(olProj.fromLonLat([Number(this.dutyStoppageData[i].longitude), Number(this.dutyStoppageData[i].latitude)])),
            });
            iconFeature.setStyle(this.dutyStoppageStyleFunction)
            iconFeature.setProperties({ properties: this.dutyStoppageData[i] });
            stoppageFeatureList.push(iconFeature);
          }
        }
        this.dutyStoppageLayer.getSource().clear();
        this.dutyStoppageLayer.getSource().addFeatures(stoppageFeatureList);
      }
    })
  }

  async plotDefinedRoute(routename: string) {

    let geomDetaiReq = new GeomDetailReq();
    geomDetaiReq.routename = routename;

    setTimeout(() => {

      return this.apiService.post(geomDetaiReq, 'geomdetails').subscribe(async (response) => {
        if (response.producerstatuscode == 200) {
          let definedRoute: GeomDetails = <GeomDetails>response.producerresponse.geomdatadetails[0];
          definedRoute.geomjson = JSON.parse(definedRoute.geomjson);
          let lineString = new LineString(definedRoute.geomjson.geometry.coordinates);
          lineString.transform('EPSG:4326', 'EPSG:3857');

          let routeFeature = new Feature({
            geometry: lineString
          });

          routeFeature.setStyle(this.geomRouteStyle);
          this.geometryLayer.getSource().clear();
          this.geometryLayer.getSource().addFeature(routeFeature);
        }
        else {
        }
      }, (err) => {
      })
    }, 5000);



  }

  async plotDefinedRouteForPNR(routename: string) {

    let geomDetaiReq = new GeomDetailReq();
    geomDetaiReq.routename = routename;
    return this.apiService.postOpen(geomDetaiReq, 'geomdetailswithoutheaderkey').subscribe(async (response) => {
      if (response.producerstatuscode == 200) {
        let definedRoute: GeomDetails = <GeomDetails>response.producerresponse.geomdatadetails[0];
        definedRoute.geomjson = JSON.parse(definedRoute.geomjson);
        let lineString = new LineString(definedRoute.geomjson.geometry.coordinates);
        lineString.transform('EPSG:4326', 'EPSG:3857');

        let routeFeature = new Feature({
          geometry: lineString
        });

        routeFeature.setStyle(this.geomRouteStyle);
        this.geometryLayer.getSource().clear();
        this.geometryLayer.getSource().addFeature(routeFeature);
      }
      else {
      }
    }, (err) => {
    })



  }

  async plotDutyStoppagesForPNR(serviceid: string, vehicleid: string, dutydate: string) {

    let dutyStoppageDetailsRequest: DutyStoppageDetailRequest = new DutyStoppageDetailRequest();
    dutyStoppageDetailsRequest.serviceid = serviceid;
    dutyStoppageDetailsRequest.vehicleidlist = [];
    dutyStoppageDetailsRequest.vehicleidlist.push(vehicleid);
    dutyStoppageDetailsRequest.dutydate = dutydate;

    return this.apiService.postOpen(dutyStoppageDetailsRequest, 'dutystoppagedetailswithoutheaderkey').subscribe(async (response: DutyStoppageDetailsResponse) => {
      if (response.producerstatuscode == 200) {
        let dutyStoppageDetailsResponse: DutyStoppageDetailsResponse = response as DutyStoppageDetailsResponse;
        this.dutyStoppageData = dutyStoppageDetailsResponse.producerresponse.dutystoppagedetail;
        let stoppageFeatureList: Feature<Geometry>[] = [];
        for (let i = 0; i < this.dutyStoppageData.length; i++) {
          if (this.dutyStoppageData[i].longitude != "0.00000" && this.dutyStoppageData[i].latitude != "0.00000") {
            let iconFeature = new Feature({
              geometry: new Point(olProj.fromLonLat([Number(this.dutyStoppageData[i].longitude), Number(this.dutyStoppageData[i].latitude)])),
            });
            iconFeature.setStyle(this.dutyStoppageStyleFunction)
            iconFeature.setProperties({ properties: this.dutyStoppageData[i] });
            stoppageFeatureList.push(iconFeature);
          }
        }
        this.dutyStoppageLayer.getSource().clear();
        this.dutyStoppageLayer.getSource().addFeatures(stoppageFeatureList);
      }
    })

  }
  plotDutyStoppagesForPNRNumber() {

    let dutyStoppageDetailsRequest: DutyStoppageDetailsWithPNRRequest = new DutyStoppageDetailsWithPNRRequest();
    dutyStoppageDetailsRequest.pnrno = this.pnrno;
    this.apiService.postOpen(dutyStoppageDetailsRequest, 'dutystoppagedetailswithpnr').subscribe(async (response: DutyStoppageDetailsWithPNRResponse) => {
      if (response.producerstatuscode == 200) {
        let dutyStoppageDetailsWithPNRResponse: DutyStoppageDetailsWithPNRResponse = response as DutyStoppageDetailsWithPNRResponse;
        this.dutyStoppageWithPNRData = dutyStoppageDetailsWithPNRResponse.producerresponse.pnr;
      }
    })
  }
  enforcementDetailsResponse: EnforcementVehicleDetails = new EnforcementVehicleDetails();
  enforcementVehicleId: string = ''
  enforcementData: EnforcementVehicleDetails[] = [];
  plotEnforcementStoppages() {
    let enforcedVehicleRequest: EnforcedVehicleRequest = new EnforcedVehicleRequest();
    enforcedVehicleRequest.enforcementvehicleid = this.enforcementVehicleId;
    this.apiService.post(enforcedVehicleRequest, 'enforcementvehicledetails').subscribe(async (response: EnforcementDetailsResponse) => {
      if (response.producerstatuscode == 200) {
        let enforcementDetailsResponse: EnforcementDetailsResponse = response as EnforcementDetailsResponse;
        this.enforcementData = enforcementDetailsResponse.producerresponse.enforcementdetails;
        let stoppageFeatureList: Feature<Geometry>[] = [];
        for (let i = 0; i < this.enforcementData.length; i++) {
          if (this.enforcementData[i].longitude != "0.00000" && this.enforcementData[i].latitude != "0.00000") {
            let iconFeature = new Feature({
              geometry: new Point(olProj.fromLonLat([Number(this.enforcementData[i].longitude), Number(this.enforcementData[i].latitude)])),
            });
            iconFeature.setStyle(this.EnforcementVehicleStyleFunction)
            iconFeature.setProperties({ properties: this.enforcementData[i] });
            stoppageFeatureList.push(iconFeature);
          }
        }
        this.dutyStoppageLayer.getSource().clear();
        this.dutyStoppageLayer.getSource().addFeatures(stoppageFeatureList);
      }
    })
  }
  EnforcementVehicleStyleFunction = (feature: FeatureLike, resolution: any): any => {
    // if (this.map.getView().getZoom() > 12) {
    return new Style({
      image: new Icon({
        anchor: [0.5, 0.5],
        anchorXUnits: 'fraction',
        anchorYUnits: 'fraction',
        src: 'assets/mapimages/bus-red.png',
        // scale: (1 / Math.pow(resolution, 1 / 4))
        scale: (1 / Math.pow(resolution, 1 / 4) <= 0.7000) ? 0.7 : (1 / Math.pow(resolution, 1 / 4)),
        // rotateWithView: true,
        // rotation: Number(feature.getProperties()['properties'].vehicledirection) * ((Math.PI) / 180)
      }),
      text: new Text({
        text: feature.getProperties().properties.busstopname,
        font: "bold 10px serif",
        fill: new Fill({
          color: '#000',
        }),
        backgroundFill: new Fill({
          color: '#fff',
        }),

        offsetY: 20
      }),
    })
  }



  geomRouteStyle = (feature: FeatureLike, resolution: any): any => {
    return new Style({
      fill: new Fill({
        color: '#00bfff',
      }),
      stroke: new Stroke({
        color: '#00bfff',
        width: this.map.getView().getZoom() * 1.1,
        lineCap: 'round',
      }),
    });
  }


  radius: any = 5
  plotRadius = (feature: FeatureLike, resolution: any): any => {
    var scale = ((this.radius ? this.radius : 5) * 1000) / (this.map.getView().getResolution() as any);
    if (this.map.getView().getZoom() > 12) {

      let iconStyle = new Style({
        image: new Icon({
          anchor: [0.5, 1],
          anchorXUnits: 'fraction',
          anchorYUnits: 'fraction',
          src: "assets/mapimages/poiicon/busstop.png",
          scale: (1 / Math.pow(resolution, 1 / 4) <= 0.7000) ? 0.7 : (1 / Math.pow(resolution, 1 / 4)),
          rotateWithView: true,
          // color: 'red'
        }),
        // text: new Text({
        //   text: this.truncatePipe.transform((feature.getProperties().properties as GeomDetails).geomname, 10),
        //   offsetY: 1,
        //   fill: new Fill({
        //     color: '#000080'
        //   }),
        //   stroke: new Stroke({
        //     color: 'white',
        //     width: 2
        //   }),
        //   font: 'bold 10px arial'
        // }),
      })
      // Create a circle style
      var circleStyle = new Style({
        image: new CircleStyle({
          // radius: 5, // Set the radius of the circle
          radius: scale, // Set the radius of the circle
          fill: new Fill({
            color: '#00000024' // Set the fill color of the circle
          }),
          stroke: new Stroke({
            color: 'black'
          })
        })
      });
      return [circleStyle, iconStyle]
    }
    else {
      let iconStyle = new Style({
        image: new Icon({
          anchor: [0.5, 1],
          anchorXUnits: 'fraction',
          anchorYUnits: 'fraction',
          src: "assets/mapimages/poiicon/busstop.png",
          scale: (1 / Math.pow(resolution, 1 / 4) <= 0.7000) ? 0.7 : (1 / Math.pow(resolution, 1 / 4)),
          // color: 'red'
        }),

      })
      // Create a circle style
      var circleStyle = new Style({
        image: new CircleStyle({
          // radius: 5, // Set the radius of the circle
          radius: scale, // Set the radius of the circle
          fill: new Fill({
            color: '#00000024' // Set the fill color of the circle
          }),
          stroke: new Stroke({
            color: 'black'
          })
        })
      });
      return [circleStyle, iconStyle]
    }
  }


  plotRadiusFiveKm = (feature: FeatureLike, resolution: any): any => {
    var scale = 5000 / (this.map.getView().getResolution() as any);
    if (this.map.getView().getZoom() > 12) {

      let iconStyle = new Style({
        image: new Icon({
          anchor: [0.5, 1],
          anchorXUnits: 'fraction',
          anchorYUnits: 'fraction',
          src: "assets/mapimages/poiicon/busstop.png",
          scale: (1 / Math.pow(resolution, 1 / 4) <= 0.7000) ? 0.7 : (1 / Math.pow(resolution, 1 / 4)),
          rotateWithView: true,
          // color: 'red'
        }),
        // text: new Text({
        //   text: this.truncatePipe.transform((feature.getProperties().properties as GeomDetails).geomname, 10),
        //   offsetY: 1,
        //   fill: new Fill({
        //     color: '#000080'
        //   }),
        //   stroke: new Stroke({
        //     color: 'white',
        //     width: 2
        //   }),
        //   font: 'bold 10px arial'
        // }),
      })
      // Create a circle style
      var circleStyle = new Style({
        image: new CircleStyle({
          // radius: 5, // Set the radius of the circle
          radius: scale, // Set the radius of the circle
          fill: new Fill({
            color: '#00000024' // Set the fill color of the circle
          }),
          stroke: new Stroke({
            color: 'black'
          })
        })
      });
      return [circleStyle, iconStyle]
    }
    else {
      let iconStyle = new Style({
        image: new Icon({
          anchor: [0.5, 1],
          anchorXUnits: 'fraction',
          anchorYUnits: 'fraction',
          src: "assets/mapimages/poiicon/busstop.png",
          scale: (1 / Math.pow(resolution, 1 / 4) <= 0.7000) ? 0.7 : (1 / Math.pow(resolution, 1 / 4)),
          // color: 'red'
        }),

      })
      // Create a circle style
      var circleStyle = new Style({
        image: new CircleStyle({
          // radius: 5, // Set the radius of the circle
          radius: scale, // Set the radius of the circle
          fill: new Fill({
            color: '#00000024' // Set the fill color of the circle
          }),
          stroke: new Stroke({
            color: 'black'
          })
        })
      });
      return [circleStyle, iconStyle]
    }
  }


  plotEnforcementVehicle(enfVehicleDetails: VehicleOnMapDAO[]) {

    let enfFeatures = [];
    for (let i = 0; i < enfVehicleDetails.length; i++) {

      let iconFeature = new Feature({
        geometry: new Point(olProj.fromLonLat([Number(enfVehicleDetails[i].longitude), Number(enfVehicleDetails[i].latitude)])),
      })
      iconFeature.setProperties({ properties: enfVehicleDetails[i] })
      iconFeature.setStyle(this.livevehicleStyleFunction)
      enfFeatures.push(iconFeature)
    }

    this.enforcementVehicleLayer.getSource().clear();
    this.enforcementVehicleLayer.getSource().addFeatures(enfFeatures);

  }

}



