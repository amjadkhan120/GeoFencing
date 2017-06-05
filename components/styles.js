'use strict';

import React, { Component } from 'react';
import {
  StyleSheet
 } from 'react-native';


var styles = StyleSheet.create({
  container: {
    flex: 1,
    flexDirection: 'column',
    backgroundColor: '#F5FCFF'    
  },
  topToolbar: {
    backgroundColor: 'rgba(20,221,30,1)',
    borderBottomColor: '#E6BE00',
    borderBottomWidth: 1,
    alignSelf: 'stretch',
    flexDirection: 'row',
    alignItems: 'center',
    padding: 5,
    height: 66
  },
  toolbarTitle: {
    fontWeight: 'bold', 
    fontSize: 18, 
    flex: 1, 
    textAlign: 'center'
  },
  iosStatusBar: {
    height: 20,
    backgroundColor: '#ffd700'
  },
  disabledButton: {
    backgroundColor: '#ccc'
  },
  iconButton: {
    width: 50,
    flex: 1
  },
  labelActivity: {
    alignItems: "center",
    justifyContent: "center",    
    borderRadius: 3,
    width: 40,
    padding: 3
  },
  label: {
    padding: 3,
    width: 75
  },
  labelText: {
    fontSize: 14,
    textAlign: 'center'
  },
  backButtonIcon: {
  	//marginRight: 
  },

  redButton: {
    backgroundColor: '#FE381E'
  },
  greenButton: {
    backgroundColor: '#16BE42'
  }
  
});

module.exports = styles;
