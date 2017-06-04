/**
 * Sample React Native App
 * https://github.com/facebook/react-native
 * @flow
 */

import React, { Component } from 'react';
import {
  AppRegistry, 
  StyleSheet,
  Text,
  View,
  Switch,
  AppState
} from 'react-native';
import MapView from 'react-native-maps';

import EventEmitter from 'EventEmitter';

import Config from './components/config';
import GeofenceView from './GeofenceView';
import BottomToolbarView from './components/BottomToolbarView';
import SettingsService from './components/lib/SettingsService';
import BGService from './components/lib/BGService';

const LATITUDE_DELTA = 0.00922;
const LONGITUDE_DELTA = 0.00421;

const STATIONARY_REGION_FILL_COLOR = "rgba(200,0,0,0.2)"
const STATIONARY_REGION_STROKE_COLOR = "rgba(200,0,0,0.2)"
const GEOFENCE_STROKE_COLOR = "rgba(17,183,0,0.5)"
const GEOFENCE_FILL_COLOR   ="rgba(17,183,0,0.2)"
const GEOFENCE_STROKE_COLOR_ACTIVATED = "rgba(127,127,127,0.5)";
const GEOFENCE_FILL_COLOR_ACTIVATED = "rgba(127,127,127, 0.2)";
const POLYLINE_STROKE_COLOR = "rgba(32,64,255,0.6)";

let eventEmitter = new EventEmitter();

export default class GeoFencing extends Component {

constructor() {
    super();

    this.bgService = BGService.getInstance();
    this.settingsService = SettingsService.getInstance();

    this.lastMotionChangeLocation = undefined;

    this.state = {
      isMainMenuOpen: false,
      currentState: AppState.currentState,
      enabled: false,
      title: 'Background Geolocation',
      centerCoordinate: {
        latitude: 0,
        longitude: 0
      },
      // ActionButton state
      isSyncing: false,
      // Map state
      isPressingOnMap: false,
      mapScrollEnabled: true,
      followsUserLocation: true,
      stationaryLocation: {timestamp: '',latitude:0,longitude:0},
      stationaryRadius: 0,
      showsUserLocation: true,
      markers: [],
      stopZones: [],
      geofences: [],
      geofencesHit: [],
      geofencesHitEvents: [],
      coordinates: [],
      settings: {},
      bgGeo: {}
    };
  }

  componentDidMount() {
    //AppState.addEventListener('change', this.onAppStateChange.bind(this));

    this.setState({
      enabled: false
    });

    // Configure BackgroundGeolocation
    this.bgService.getState((state) => {
      this.configureBackgroundGeolocation(state);
    });

    // Fetch current app settings state.
    this.settingsService.getState((state) => {
      this.setState({
        settings: state 
      });
    });    

    this.settingsService.on('change', this.onSettingsChanged.bind(this));
    this.bgService.on('change', this.onBackgroundGeolocationChanged.bind(this));
  }


  componentWillUnmount() {

    //AppState.removeEventListener('change', this.onAppStateChange.bind(this));
    let bgGeo = this.bgService.getPlugin();

    // Unregister BackgroundGeolocation event-listeners!
    bgGeo.un("location", this.onLocation);
    bgGeo.un("http", this.onHttp);
    bgGeo.un("geofence", this.onGeofence);
    bgGeo.un("heartbeat", this.onHeartbeat);
    bgGeo.un("error", this.onError);
    bgGeo.un("motionchange", this.onMotionChange);
    bgGeo.un("schedule", this.onSchedule);
    bgGeo.un("geofenceschange", this.onGeofencesChange);

    this.bgService.removeListeners();
    this.settingsService.removeListeners();
  }

  onAppStateChange(currentAppState) {
    var showsUserLocation = (currentAppState === 'background') ? false : true;

    this.setState({
      currentAppState: currentAppState,
      showsUserLocation: showsUserLocation
    });
  }

  onSettingsChanged(event) {
    switch(event.name) {
      case 'hideMarkers':
        break;
      case 'hidePolyline':
        break;
      case 'showGeofenceHits':
        break;
      case 'followsUserLocation':
        this.setState({followsUserLocation: event.value});
        if (event.value) {
          this.setState({mapScrollEnabled: false});
        }
        break;
    }
    //this.setState({settings: event.state});
  }

  onBackgroundGeolocationChanged(name, value) {
    let bgGeo = this.state.bgGeo;
    bgGeo[name] = value;
    this.setState({bgGeo: bgGeo});
  }

configureBackgroundGeolocation(config) {
    let bgGeo = this.bgService.getPlugin();
    ////
    // 1. Set up listeners on BackgroundGeolocation events
    //
    // location event
    this.onLocation = this.onLocation.bind(this);
    this.onHttp = this.onHttp.bind(this);
    this.onGeofence = this.onGeofence.bind(this);
    this.onHeartbeat = this.onHeartbeat.bind(this);
    this.onError = this.onError.bind(this);
    this.onMotionChange = this.onMotionChange.bind(this);
    this.onSchedule = this.onSchedule.bind(this);
    this.onGeofencesChange = this.onGeofencesChange.bind(this);

    bgGeo.on("location", this.onLocation);
    // http event
    bgGeo.on("http", this.onHttp);
    // geofence event
    bgGeo.on("geofence", this.onGeofence);
    // heartbeat event
    bgGeo.on("heartbeat", this.onHeartbeat);
    // error event
    bgGeo.on("error", this.onError);
    // motionchange event
    bgGeo.on("motionchange", this.onMotionChange);
    // schedule event
    bgGeo.on("schedule", this.onSchedule);
    // geofenceschange
    bgGeo.on("geofenceschange", this.onGeofencesChange);


    bgGeo.configure(config, (state) => {
      console.log('- configure success.  Current state: ', state);

      // Broadcast to child components.
      eventEmitter.emit('enabled', state.enabled);

      // Start the scheduler if configured with one.
      if (state.schedule.length) {
        bgGeo.startSchedule(function() {
          console.info('- Scheduler started');
        });
      }

      // Update UI
      this.setState({
        enabled: state.enabled,
        bgGeo: state
      });
    });
  }

  onLocation(location) {
    //console.log('- location: ', JSON.stringify(location));
    if (!location.sample) {
      this.addMarker(location);
    }
    // Seems to fix PolyLine rendering issue by wrapping call to setCenter in a timeout
    setTimeout(function() {
      this.setCenter(location);
    }.bind(this));

  }

  onGeofencesChange(event) {
    var on  = event.on;
    var off = event.off;
    var geofences  = this.state.geofences;

    // Filter out all "off" geofences.
    geofences = geofences.filter(function(geofence) {
      return off.indexOf(geofence.identifier) < 0;
    });

    // Add new "on" geofences.
    on.forEach(function(geofence) {
      var marker = geofences.find(function(m) { return m.identifier === geofence.identifier;});
      if (marker) { return; }
      geofences.push(this.createGeofenceMarker(geofence));
    }.bind(this));

    this.setState({
      geofences: geofences
    });
  }

  onPressGeofence(event) {
    console.log('NOT IMPLEMENTED');
  }

  onHeartbeat(params) {
    console.log("- heartbeat: ", params.location);
  }

  onHttp(response) {
    console.log('- http ' + response.status);
    console.log(response.responseText);
  }

  onGeofence(geofence) {
    let location = geofence.location;
    var marker = this.state.geofences.find((m) => {
      return m.identifier === geofence.identifier;
    });
    if (!marker) { return; }

    marker.fillColor = GEOFENCE_STROKE_COLOR_ACTIVATED;
    marker.strokeColor = GEOFENCE_STROKE_COLOR_ACTIVATED;

    let coords = location.coords;

    let hit = this.state.geofencesHit.find((hit) => {
      return hit.identifier === geofence.identifier;
    });

    if (!hit) {
      hit = {
        identifier: geofence.identifier,
        radius: marker.radius,
        center: {
          latitude: marker.center.latitude, 
          longitude: marker.center.longitude
        },
        events: []
      };
      this.setState({
        geofencesHit: [...this.state.geofencesHit, hit]
      });
    }
    // Get bearing of location relative to geofence center.
    let bearing = this.bgService.getBearing(marker.center, location.coords);
    let edgeCoordinate = this.bgService.computeOffsetCoordinate(marker.center, marker.radius, bearing);
    let event = {
      coordinates: [
        edgeCoordinate,
        {latitude: coords.latitude, longitude: coords.longitude},
      ],
      action: geofence.action,
      key: geofence.identifier + ":" + geofence.action + ":" + location.timestamp
    };
    this.setState({
      geofencesHitEvents: [...this.state.geofencesHitEvents, event]
    });
  }

  onSchedule(state) {
    console.log("- schedule", state.enabled, state);
    this.setState({
      enabled: state.enabled
    });
  }

  onRegionChange(coordinate) {

  }

  setCenter(location) {
    if (!this.refs.map || !this.state.followsUserLocation) { return; }
    this.refs.map.animateToCoordinate({
      latitude: location.coords.latitude,
      longitude: location.coords.longitude
    });
  }

  onMapPanDrag() {
    this.setState({
      followsUserLocation: false,
      mapScrollEnabled: true
    });
    this.settingsService.set('followsUserLocation', false);
  }

  onLongPress(params) {
    var coordinate = params.nativeEvent.coordinate;
    this.bgService.playSound('LONG_PRESS_ACTIVATE');
    this.geoFencingView.open(coordinate);
  }

  onSubmitGeofence(params) {
    var bgGeo = this.bgService.getPlugin();
    this.bgService.playSound('ADD_GEOFENCE');
    bgGeo.addGeofence(params, (identifier) => {
      this.setState({
        geofences: [ ...this.state.geofences, this.createGeofenceMarker(params)]
      });
    }, (error) => {
      console.warn('- addGeofence error: ', error);
    });
  }

  clearMarkers() {
    this.setState({
      coordinates: [],
      markers: [],
      stopZones: [],
      geofencesHit: [],
      geofencesHitEvents: []
    });
  }

  addMarker(location) {
    this.setState({
      markers: [...this.state.markers, this.createMarker(location)],
      coordinates: [...this.state.coordinates, {
        latitude: location.coords.latitude,
        longitude: location.coords.longitude
      }]
    });    
  }

  createMarker(location) {
    return {
      key: location.uuid,
      title: location.timestamp,
      heading: location.coords.heading,
      coordinate: {
        latitude: location.coords.latitude, 
        longitude: location.coords.longitude
      }
    };
  }

  createGeofenceMarker(geofence) {
    return {
      radius: geofence.radius,
      center: {
        latitude: geofence.latitude,
        longitude: geofence.longitude
      },
      identifier: geofence.identifier,
      strokeColor:GEOFENCE_STROKE_COLOR,
      fillColor: GEOFENCE_FILL_COLOR
    }
  }

  onError(error) {
    console.log('- ERROR: ', JSON.stringify(error));
  }

  onMotionChange(event) {
    var location = event.location;
    console.log("- motionchange", JSON.stringify(event));
    if (event.isMoving) {
      if (this.lastMotionChangeLocation) {
        this.setState({
          stopZones: [...this.state.stopZones, {
            coordinate: {
              latitude: this.lastMotionChangeLocation.coords.latitude,
              longitude: this.lastMotionChangeLocation.coords.longitude
            },
            key: this.lastMotionChangeLocation.timestamp
          }]
        });
      }
      this.setState({
        stationaryRadius: 0,
        stationaryLocation: {
          timestamp: '',
          latitude: 0,
          longitude: 0
        }
      });
    } else {
      this.setState({
        stationaryRadius: (this.bgService.isLocationTrackingMode()) ? 200 : (this.state.bgGeo.geofenceProximityRadius/2),
        stationaryLocation: {
          timestamp: event.location.timestamp,
          latitude: event.location.coords.latitude,
          longitude: event.location.coords.longitude
        }
      });
    }
    this.lastMotionChangeLocation = location;
  }

  onClickEnable() {
    let enabled = !this.state.enabled;
    var bgGeo = this.bgService.getPlugin();

    if (enabled) {
      if (this.bgService.isLocationTrackingMode()) {
        // Location tracking mode
        bgGeo.start((state) => {
          console.log('- Start success: ', state);
        });
      } else {
        // Geofences-only mode
        bgGeo.startGeofences((state) => {
          console.log('- Start geofences: ', state);
        });
      }
    } else {
      bgGeo.stop(() => {
        console.log('- stopped');
      });

      // Clear markers, polyline, geofences, stationary-region
      this.setState({
        coordinates: [],
        markers: [],
        geofences: [],
        stationaryRadius: 0,
        stationaryLocation: {
          timestamp: '',
          latitude: 0,
          longitude: 0
        },
        stopZones: [],
        geofencesHit: [],
        geofencesHitEvents: []
      });
    }

    this.setState({
      enabled: enabled
    });

    // Transmit to other components
    eventEmitter.emit('enabled', enabled);
  }

renderActiveGeofences() {
    return this.state.geofences.map((geofence) => (
      <MapView.Circle
        key={geofence.identifier}
        radius={geofence.radius}
        center={geofence.center}
        strokeWidth={1}
        strokeColor={geofence.strokeColor}
        fillColor={geofence.fillColor}
        onPress={this.onPressGeofence}
      />
    ));
  }

  onLongPress(params) {
    var coordinate = params.nativeEvent.coordinate;
    this.bgService.playSound('LONG_PRESS_ACTIVATE');
    this.geofenceView.open(coordinate);
  }

  onSubmitGeofence(params) {
    var bgGeo = this.bgService.getPlugin();
    this.bgService.playSound('ADD_GEOFENCE');
    bgGeo.addGeofence(params, (identifier) => {
      this.setState({
        geofences: [ ...this.state.geofences, this.createGeofenceMarker(params)]
      });
    }, (error) => {
      console.warn('- addGeofence error: ', error);
    });
  }

  render() {
    return (
      <View ref="workspace" style={styles.container}> 
      <MapView
          ref="map"
          style={styles.map}
          showsUserLocation={true}
          onLongPress={this.onLongPress.bind(this)}
          //onRegionChange={this.onRegionChange.bind(this)}
          //onPanDrag={this.onMapPanDrag.bind(this)}
          scrollEnabled={this.state.mapScrollEnabled}
          showsMyLocationButton={false}
          showsPointsOfInterest={false}
          showsScale={false}
          showsTraffic={false}
          toolbarEnabled={false}
          initialRegion={{
            //33.664286, 73.052471
            latitude: 33.664286,
            longitude: 73.052471,
            latitudeDelta: LATITUDE_DELTA,
            longitudeDelta: LONGITUDE_DELTA
          }}>
          <MapView.Circle
            key={this.state.stationaryLocation.timestamp}
            radius={this.state.stationaryRadius}
            fillColor={STATIONARY_REGION_FILL_COLOR}
            strokeColor={STATIONARY_REGION_STROKE_COLOR}
            strokeWidth={1}
            center={{latitude: this.state.stationaryLocation.latitude, longitude: this.state.stationaryLocation.longitude}}
          />
          <MapView.Marker
            key="Center"
            coordinate={this.state.centerCoordinate}
            title="Center"
          />
          <MapView.Polyline
            key="polyline"
            coordinates={(!this.state.settings.hidePolyline) ? this.state.coordinates : []}
            geodesic={true}
            strokeColor={Config.colors.polyline_color}
            strokeWidth={6}
            zIndex={0}
          />
         {this.renderActiveGeofences()}
        </MapView>
        <BottomToolbarView eventEmitter={eventEmitter} enabled={this.state.enabled} />
        <GeofenceView ref={(view) => {this.geofenceView = view; }} onSubmit={this.onSubmitGeofence.bind(this)}/>
      </View>
    );
  }
}

var styles = StyleSheet.create({
  topToolbar: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0
  },
  container: {
    flex: 1,
    paddingTop: 0
  },
  map: {
    flex: 1
  },
  // Map Menu on top-right.  What a pain to style this thing...
  mapMenu: {
    position:'absolute',
    right: 0,
    top: 55,
    flexDirection: 'row',
  },
  mapMenuButtonContainer: {
    marginRight: 10
  },
  mapMenuButton: {
    width: 40,
    height: 40,
    padding: 5,
    flexDirection: 'row',
    justifyContent: 'center'
  },
  mapMenuButtonIcon: {
    marginRight: 0
  },
  // Floating Action Button
  actionButtonIcon: {
    color: '#000'
  },
  actionButtonSpinner: {
    marginLeft:-2,
    marginTop:-2
  },
  // Map overlay styles
  marker: {
    borderWidth:1,
    borderColor:'black',
    backgroundColor: Config.colors.polyline_color,
    borderRadius: 0,
    zIndex: 0,
    width: 32,
    height:32
  },
  stopZoneMarker: {
    borderWidth:1,
    borderColor: 'red',
    backgroundColor: Config.colors.red,
    opacity: 0.2,
    borderRadius: 15,
    zIndex: 0,
    width: 30,
    height: 30
  },
  geofenceHitMarker: {
    borderWidth:1,
    borderColor:'black',
    borderRadius: 6,
    zIndex: 10,
    width: 12,
    height:12
  },
  markerIcon: {
    borderWidth:1,
    borderColor:'#000000',
    backgroundColor: Config.colors.polyline_color,
    width: 10,
    height: 10,
    borderRadius: 5
  }  
});

AppRegistry.registerComponent('GeoFencing', () => GeoFencing);
