  'use strict';

  const BinaryFile = require('binary-file');
  let crc = require('crc/crc16kermit');
  const { exit } = require('process');

  
  const myBinaryFile = new BinaryFile('C://Users//jose_//Desktop//test.fa5c', 'r', true);
  
  function ascii_to_hexa(str) {
	  var arr1 = [];
	  for (var n = 0, l = str.length; n < l; n ++) {
		  var hex = Number(str.charCodeAt(n));
		  arr1.push(hex);
	  }
	
    return arr1;
  }

  /**
   * Build a message for the Ruptela based on Command 2/102 – Device Configuration Data
   * @param {*} command 
   * @param {*} payload 
   * @returns byte array of message
   */
  function build_message( command, payload ) {
    var result = [];
    // Packet length
    var len = payload.length + 1 + command.length + 2;
    var lenHex = ('0000' + len.toString(16)).slice(-4); 
    result.push( '0x00' ); // Place Holder
    result.push( '0x00' ); // Place Holder
    
    // 66 CMD 1 Byte
    [0x66].forEach(element => result.push(element) );

    // Command X bytes
    ascii_to_hexa(command).forEach(element => result.push( element) );

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
  
  async function readConfigurationFile() {
    try {

      // #cfg_start@
      console.log("#cfg_start@");
      build_message('#cfg_start@', []).forEach( element => process.stdout.write( ( '00' + element.toString(16).toUpperCase()).slice(-2)  ) );
      console.log();

      await myBinaryFile.open();
      //console.log('File opened');

      while(await myBinaryFile.tell() < await myBinaryFile.size() ) {
        //console.log(`Tell: ${await myBinaryFile.tell()} Size: ${await myBinaryFile.size()}`);
        var payload = [];

        const bytesLength = await myBinaryFile.readUInt16();
        payload.push( bytesLength & 0x00ff );
        payload.push( bytesLength & 0xff00 );        
        //console.log(`Bytes Len: ${bytesLength}`);

        const packetID = await myBinaryFile.readUInt8();
        payload.push( ('00' + packetID).slice(-2) );
        //console.log(`Packet ID: ${packetID}`);

        const paramsCount = await myBinaryFile.readUInt16();
        payload.push( paramsCount & 0x00ff );
        payload.push( paramsCount & 0xff00 );        
        //console.log(`Params Count: ${paramsCount}`);
        //console.log();        

        for ( var i = 0 ; i < paramsCount; i++ ) {
            const paramKey = await myBinaryFile.readUInt16();
            const paramKeyStr = paramKey.toString(16)
            //console.log(`Key[${i}]: ${paramKeyStr}`);
            payload.push( paramKey & 0x00ff );
            payload.push( paramKey & 0xff00 );            

            const paramValueLen = await myBinaryFile.readUInt8();
            payload.push( paramValueLen );
            //console.log(`Value Len: ${paramValueLen}`);
            //console.log();
            for ( var j = 0 ; j < paramValueLen; j++ ) {
                const paramValue = await myBinaryFile.readUInt8();
                payload.push( paramValue );
            }
        }

        //console.log( payload );

        console.log("#cfg_send@" + packetID );
        build_message('#cfg_send@', payload).forEach( element => process.stdout.write( ( '00' + element.toString(16).toUpperCase()).slice(-2)  ) );
        console.log("");
        console.log("");

        
        // if @cfg_sts#<0x31> <0x01> <0x0D><0x0A>

      }

      console.log("#cfg_write@" );
      build_message('#cfg_write@', []).forEach( element => process.stdout.write( ( '00' + element.toString(16).toUpperCase()).slice(-2)  ) );
      console.log("");
      console.log("");

      console.log("#cfg_end@"  );
      build_message('#cfg_end@', []).forEach( element => process.stdout.write( ( '00' + element.toString(16).toUpperCase()).slice(-2)  ) );
      console.log("");
      console.log("");
     
     

      exit(0);

    } catch (err) {
      console.log(`There was an error: ${err}`);
    }

  }

  
  readConfigurationFile()
