/*
Ruptela Uploader
Copyright (C) 2022 Jose Castellanos Molina

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU General Public License as published by
the Free Software Foundation, either version 3 of the License, or
(at your option) any later version.

This program is distributed in the hope that it will be useful,
but WITHOUT ANY WARRANTY; without even the implied warranty of
MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
GNU General Public License for more details.

You should have received a copy of the GNU General Public License
along with this program.  If not, see <http://www.gnu.org/licenses/>.
*/
const BinaryFile = require('binary-file');
let crc = require('crc/crc16kermit');
const https = require('https')
const events = require('events');
const config = require('config');
const fs = require('fs');

class RuptelaUploader {
  constructor(serverUrl, serverPort, authorizationHeader, myemitter) {
    this.serverUrl = serverUrl;
    this.serverPort = serverPort;
    this.authorizationHeader = authorizationHeader;
    this.myemitter = myemitter;
  }
  
  /**
   * Send a command to the specific device
   * @param {*} deviceId 
   * @param {*} commandName 
   * @param {*} datos 
   */
  post_traccar_command( deviceId, commandName, datos) {
    
    const data = JSON.stringify({
      id: 0,
      deviceId: deviceId,
      description: commandName,
      type: "custom",
      attributes: { 
        "data": datos
      }
    })

    const options = {
      hostname: this.serverUrl,
      port: this.serverPort,
      path: '/api/commands/send',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': data.length,
        'Authorization': this.authorizationHeader
      }
    }

    //const req = https.request(options );

    const req = https.request(options, res => {
      console.log(`command: ${commandName} statusCode: ${res.statusCode}`);
    });
    
    req.write(data)
    req.end()

  }

  /**
   * Converts a String into Hexa characters
   * @param {*} str 
   * @returns 
   */
  ascii_to_hexa(str) {
	  var arr1 = [];
	  for (var n = 0, l = str.length; n < l; n ++) {
		  var hex = Number(str.charCodeAt(n));
		  arr1.push(hex);
	  }
	
    return arr1;
  }

  waitForEvent (emitter, event) {
    return new Promise((resolve, reject) => {
        const success = (val) => {
            emitter.off("error", fail);
            resolve(val);
        };
        const fail = (err) => {
            emitter.off(event, success);
            reject(err);
        };
        emitter.once(event, success);
        emitter.once("error", fail);
    });
  }

  /**
   * Wait for the event commandResult to be emitted, or timeouts
   * @param {NUmber of millis to wait} timeout 
   */
  wait_event_or_timeout(timeout, tempEmitter, tempCommand) {
    
    return Promise.race([
        this.waitForEvent(tempEmitter, tempCommand),
        new Promise((_, reject) => setTimeout(() => reject(new Error('Timeout!')), timeout) )
      ]).catch( function(err) {
        
      })

  }

  /**
   * Build a message for the Ruptela based on Command 2/102 – Device Configuration Data
   * @param {*} command 
   * @param {*} payload 
   * @returns byte array of message
   */
  build_message( command, payload ) {
    var result = [];
    // Packet length
    var len = payload.length + 1 + command.length + 2;
    var lenHex = ('0000' + len.toString(16)).slice(-4); 
    result.push( '0x00' ); // Place Holder
    result.push( '0x00' ); // Place Holder
    
    // 66 CMD 1 Byte
    [0x66].forEach(element => result.push(element) );

    // Command X bytes
    this.ascii_to_hexa(command).forEach(element => result.push( element) );

    // Payload
    payload.forEach(element => result.push( element) );

    // Break line 2 Bytes
    [0x0d, 0x0a].forEach(element => result.push( element) );
    
    // CRC16 2 Byte
    var crcCalculated = ('0000' + crc(result).toString(16)).slice(-4); 
    
    result.push( parseInt( crcCalculated.substring(0,2),16) );
    result.push( parseInt( crcCalculated.substring(2,4),16) );

    result[0] = parseInt( lenHex.substring(0,2), 16 );
    result[1] = parseInt( lenHex.substring(2,4), 16 );
    
    return result;
  }

  hexToString(str) {
    const buf = new Buffer(str, 'hex');
    return buf.toString('utf8');
  }

  /**
   * 
   * @param {*} device 
   * @param {*} path 
   */
  async sendConfigurationFile(device, path) {
    const myBinaryFile = new BinaryFile( path , 'r', true);
    const stateEmitter = new events.EventEmitter();
    const callback = (stream) => {
      console.log( "addListener Device " + stream.device.id + " attributes " + stream.event.attributes.result );
      if ( stream.device.id == device && this.hexToString(stream.event.attributes.result).startsWith("@cfg_sts#1")  ) {
        stateEmitter.emit("state", stream);
      }
    };
    
    try {
      var buffer = [];
      var packs = 18;
      var timeout = 60 * 1000;
      
      this.myemitter.addListener("commandResult", callback );

      await myBinaryFile.open();

      // #cfg_start@
      this.build_message('#cfg_start@', []).forEach( element => buffer.push( ( '00' + element.toString(16).toUpperCase()).slice(-2) ) );
      this.post_traccar_command(device, '#cfg_start@', buffer.join(''));
      let result = await this.wait_event_or_timeout( timeout, stateEmitter, "state" );
      // Wait for @cfg_sts#10 or timeout
      if ( !this.hexToString(result.event.attributes.result).startsWith("@cfg_sts#1") ) {
        new Error('Wrong response');
      }
            
      while(await myBinaryFile.tell() < await myBinaryFile.size() ) {
        var payload = [];

        const bytesLength = await myBinaryFile.readUInt16();
        payload.push( bytesLength & 0x00ff );
        payload.push( (bytesLength >> 8) & 0x00ff );        
      
        const packetID = await myBinaryFile.readUInt8();
        payload.push( packetID );
      
        const paramsCount = await myBinaryFile.readUInt16();
        payload.push( paramsCount & 0x00ff );
        payload.push( (paramsCount >> 8) & 0x00ff );        
      
        for ( var i = 0 ; i < paramsCount; i++ ) {
            const paramKey = await myBinaryFile.readUInt16();
                        
            payload.push( paramKey & 0x00ff );
            payload.push( (paramKey >> 8) & 0x00ff );            

            const paramValueLen = await myBinaryFile.readUInt8();
            payload.push( paramValueLen );
            
            for ( var j = 0 ; j < paramValueLen; j++ ) {
                const paramValue = await myBinaryFile.readUInt8();
                payload.push( paramValue );
            }
        }

        buffer = [];
        this.build_message('#cfg_send@', payload).forEach( element => buffer.push( ( '00' + element.toString(16).toUpperCase()).slice(-2)  ) );
        this.post_traccar_command(device, "#cfg_send@" + String(packetID), buffer.join(''));
        let result = await this.wait_event_or_timeout( timeout, stateEmitter, "state" );
        // Wait for @cfg_sts# <PAcketNumber> or timeout
        console.log( this.hexToString(result.event.attributes.result) );
        if ( !this.hexToString(result.event.attributes.result).startsWith("@cfg_sts#1") ) {
          new Error('Wrong response');
        }
        
      }

      // #cfg_write@
      buffer = [];
      this.build_message('#cfg_write@', []).forEach( element => buffer.push( ( '00' + element.toString(16).toUpperCase()).slice(-2)  ) );
      this.post_traccar_command(device, '#cfg_write@', buffer.join(''));
      result = await this.wait_event_or_timeout( timeout, stateEmitter, "state"  );
      // Wait for @cfg_sts#10 or timeout
      console.log( this.hexToString(result.event.attributes.result) );
      if ( !this.hexToString(result.event.attributes.result).startsWith("@cfg_sts#1") ) {
        new Error('Wrong response');
      }
      

      // #cfg_end@
      buffer = [];
      this.build_message('#cfg_end@', []).forEach( element => buffer.push( ( '00' + element.toString(16).toUpperCase()).slice(-2)  ) );
      this.post_traccar_command(device, '#cfg_end@', buffer.join(''));
      result = await this.wait_event_or_timeout( timeout, stateEmitter, "state"  );
      // Wait for @cfg_sts#10 or timeout
      console.log( result.event.attributes.result );
      if ( !this.hexToString(result.event.attributes.result).startsWith("@cfg_sts#1") ) {
        new Error('Wrong response');
      }
      
     
    } catch (err) {
      buffer = [];
      console.log(`There was an error: ${err}`);
      this.build_message('#cfg_end@', []).forEach( element => buffer.push( ( '00' + element.toString(16).toUpperCase()).slice(-2)  ) );
      this.post_traccar_command(device, '#cfg_end@', buffer.join(''));
      this.wait_event_or_timeout( timeout, stateEmitter, "state"  );
      
    } finally {
      // delete temp file
      myBinaryFile.close();
      fs.unlinkSync(path);   
      // Remove listener
      this.myemitter.removeListener("commandResult", callback );
    }

  }

  

  

  async readConfigurationFile(device) {
    
    const stateEmitter = new events.EventEmitter();
    const callback = (stream) => {
      console.log( "addListener Device " + stream.device.id );
      if ( stream.device.id == device ) {
        stateEmitter.emit("state", stream);
      }
    };
    
    const myBinaryFile = new BinaryFile(config.get('server.local_upload_dir') + '/' + device + '_config.fp4c' , 'w+', true );

    try {
      var buffer = [];
      var timeout = 60 * 1000;
      
      this.myemitter.addListener("commandResult", callback );

      // #cfg_start@
      this.build_message('#cfg_start@', []).forEach( element => buffer.push( ( '00' + element.toString(16).toUpperCase()).slice(-2) ) );
      this.post_traccar_command(device, '#cfg_start@', buffer.join(''));
      let result = await this.wait_event_or_timeout( timeout, stateEmitter, "state" );
      // Wait for @cfg_sts#10 or timeout
      console.log( result.event.attributes.result );
      if ( !String(result.event.attributes.result).startsWith("@cfg_sts#1") ) {
        new Error('Wrong response');
      }

      
      await myBinaryFile.open();
      
      let packetID = 0x01;
      while( true ) {
        var payload = [packetID];

        buffer = [];
        this.build_message('#cfg_get@', payload).forEach( element => buffer.push( ( '00' + element.toString(16).toUpperCase()).slice(-2)  ) );
        this.post_traccar_command(device, "#cfg_get@", buffer.join(''));
        let result = await this.wait_event_or_timeout( timeout, stateEmitter, "state" );
        // Wait for @cfg_sts# <PAcketNumber> or timeout
        let resultAsString = String(result.event.attributes.result);
        

        let header = resultAsString.substring(0,10);
        let frame = resultAsString.substring(10, resultAsString.length-4);
	      let packetSize = frame.substring(0,4);
        let packetNumber = frame.substring(4,6);
	      
        console.log( "header: " + this.hexToString(header) + " " + packetSize + " " + packetNumber );
        myBinaryFile.write( Buffer.from(frame) );

	      
        packetID++;
        if ( packetSize === '0000' )
          break;
              
      }


      
      // #cfg_end@
      buffer = [];
      this.build_message('#cfg_end@', []).forEach( element => buffer.push( ( '00' + element.toString(16).toUpperCase()).slice(-2)  ) );
      this.post_traccar_command(device, '#cfg_end@', buffer.join(''));
      result = await this.wait_event_or_timeout( timeout, stateEmitter, "state"  );
      // Wait for @cfg_sts#10 or timeout
      console.log( result.event.attributes.result );
      if ( !String(result.event.attributes.result).startsWith("@cfg_sts#1") ) {
        new Error('Wrong response');
      }
      
    
    } catch (err) {
      buffer = [];
      console.log(`There was an error: ${err}`);
      this.build_message('#cfg_end@', []).forEach( element => buffer.push( ( '00' + element.toString(16).toUpperCase()).slice(-2)  ) );
      this.post_traccar_command(device, '#cfg_end@', buffer.join(''));
      this.wait_event_or_timeout( timeout, stateEmitter, "state"  );
      
    } finally {
      myBinaryFile.close();
      // Remove listener
      this.myemitter.removeListener("commandResult", callback );
    }

  }

}

exports.RuptelaUploader = RuptelaUploader;
