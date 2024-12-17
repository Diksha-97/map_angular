import { Component } from '@angular/core';
import 'ol/ol.css'; // Import OpenLayers default CSS
import Map from 'ol/Map';
import OSM from 'ol/source/OSM';
import TileLayer from 'ol/layer/Tile';
import View from 'ol/View';
@Component({
  selector: 'app-map',
  standalone: true,
  imports: [],
  templateUrl: './map.component.html',
  styleUrl: './map.component.css'
})
export class MapComponent {

  private map!: Map;
  // The map initialization code runs inside ngAfterViewInit() because Angular needs to ensure the DOM is ready before attaching the map.





  ngAfterViewInit(): void {
    // Initialize OpenLayers Map
    this.map = new Map({
      target: 'map', // The ID of the map container
      layers: [
        new TileLayer({
          source: new OSM(), // OpenStreetMap layer
        }),
      ],
      view: new View({
        center: [0, 0], // Coordinates in EPSG:3857
        zoom: 2, // Initial zoom level
      }),
    });
  }
}

