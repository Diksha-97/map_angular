import { Component, OnInit } from '@angular/core';
import 'ol/ol.css'; // Import OpenLayers default CSS
import Map from 'ol/Map';
import OSM from 'ol/source/OSM';
import TileLayer from 'ol/layer/Tile';
// import VectorTileLayer from 'ol/layer/VectorTile';
import VectorLayer from 'ol/layer/Vector';
import VectorSource from 'ol/source/Vector';
import View from 'ol/View';
import Feature from 'ol/Feature';
import { LineString, Point } from 'ol/geom';
import Style from 'ol/style/Style';
import Icon from 'ol/style/Icon';
import Text from 'ol/style/Text';
import { Fill } from 'ol/style';

@Component({
  selector: 'app-map',
  standalone: true,
  imports: [],
  templateUrl: './map.component.html',
  styleUrl: './map.component.css'
})
export class MapComponent implements OnInit {

  private map!: Map;
  // The map initialization code runs inside ngAfterViewInit() because Angular needs to ensure the DOM is ready before attaching the map.




  ngOnInit(): void {
    this.renderMap();


  }

  renderMap() {
    this.pointMap();
    const iconFeature = new Feature({
      geometry: new Point([0, 0]),
      name: 'Null Island',
      population: 4000,
      rainfall: 500,
    });
    const iconFeature2 = new Feature({
      geometry: new LineString([0, 0]),
      name: 'Lapata Island',
      population: 4000,
      rainfall: 500,
    });
    const iconStyle = new Style({
      image: new Icon({
        anchor: [0, 0],
        anchorXUnits: 'fraction',
        anchorYUnits: 'pixels',
        src: 'https://static.vecteezy.com/system/resources/thumbnails/019/897/155/small/location-pin-icon-map-pin-place-marker-png.png',
        height: 15,
        width: 15,
        rotation: 90,
        rotateWithView: true,


      }),
      text: new Text({
        text: "ytf",

        font: "bold 12px serif",
        fill: new Fill({
          color: '#FFF',

        }),

      })
    });
    const iconStyle2 = new Style({
      image: new Icon({
        anchor: [0, 0],
        anchorXUnits: 'fraction',
        anchorYUnits: 'pixels',
        src: 'https://static.vecteezy.com/system/resources/thumbnails/019/897/155/small/location-pin-icon-map-pin-place-marker-png.png',
        height: 15,
        width: 15,
        rotation: 90,
        rotateWithView: true,


      }),
      text: new Text({
        text: "lapata",

        font: "bold 12px serif",
        fill: new Fill({
          color: '#FFF',

        }),

      })
    });
    iconFeature.setStyle(iconStyle);
    iconFeature2.setStyle(iconStyle2);
    const lineFeature = this.lineStringFeature();
    const vectorSource = new VectorSource({
      features: [iconFeature,lineFeature],
    });
    const vectorLayer = new VectorLayer({
      source: vectorSource,
    });





    this.map = new Map({
      // Initialize OpenLayers Map
      target: 'map', // The ID of the map container
      layers: [
        new TileLayer({
          visible: true,
          preload: Infinity,
          source: new OSM(), // OpenStreetMap layer
        }), vectorLayer
      ],
      view: new View({
        center: [0, 0], // Coordinates in EPSG:3857
        zoom: 2, // Initial zoom level
      }),
    });




  }
  pointMap() {

    const iconFeature = new Feature({
      geometry: new Point([0, 0]),
      name: 'Null Island',
      population: 4000,
      rainfall: 500,
    });
    const iconStyle = new Style({
      image: new Icon({
        anchor: [0, 0],
        anchorXUnits: 'fraction',
        anchorYUnits: 'pixels',
        src: 'https://static.vecteezy.com/system/resources/thumbnails/019/897/155/small/location-pin-icon-map-pin-place-marker-png.png',
      }),
    });

    iconFeature.setStyle(iconStyle);


  }


  //draw linestring 2d
  lineStringFeature() {

    const iconFeature = new Feature({
      geometry: new LineString([
        [4e6, -2e6],
        [8e6, 2e6],
      ]),

      name: 'Lapata Iceland',
      population: 4000,
      rainfall: 500,
    });
    return iconFeature;


  }

}

