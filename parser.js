  'use strict';

  const BinaryFile = require('binary-file');
  let crc = require('crc/crc16kermit');
  const { exit, send } = require('process');
  const https = require('https')

  
  const myBinaryFile = new BinaryFile('C://Users//jose_//Desktop//test.fa5c', 'r', true);

  function post_traccar_command(commandName, datos) {

    const data = JSON.stringify({
      id: 0,
      deviceId: 133,
      description: commandName,
      type: "custom",
      attributes: { 
        "data": datos
      }
    })

    const options = {
      hostname: 'gps.tecka.mx',
      port: 443,
      path: '/api/commands/send',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': data.length,
        'Authorization': 'Basic YWRtaW46Um9uaU1AbjA3aGE3N2Fu'
      }
    }

    const req = https.request(options, res => {
      console.log(`statusCode: ${res.statusCode}`)
    
      res.on('data', d => {
        process.stdout.write(d)
      })
    })
    
    req.on('error', error => {
      console.error(error)
    })
    
    req.write(data)
    req.end()

  }
  
  function ascii_to_hexa(str) {
	  var arr1 = [];
	  for (var n = 0, l = str.length; n < l; n ++) {
		  var hex = Number(str.charCodeAt(n));
		  arr1.push(hex);
	  }
	
    return arr1;
  }

  const keypress = async () => {
    process.stdin.setRawMode(true)
    return new Promise(resolve => process.stdin.once('data', () => {
      process.stdin.setRawMode(false)
      resolve()
    }))
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
      var buffer = [];
      var packs = 1;
      // #cfg_start@
      console.log("#cfg_start@");
      build_message('#cfg_start@', []).forEach( element => buffer.push( ( '00' + element.toString(16).toUpperCase()).slice(-2) ) );
      post_traccar_command('Start', buffer.join(''));
      console.log(); 

      await keypress();

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

        if ( packetID > packs ) {
          break;
        }

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
        buffer = [];
        console.log("#cfg_send@" + packetID );
        build_message('#cfg_send@', payload).forEach( element => buffer.push( ( '00' + element.toString(16).toUpperCase()).slice(-2)  ) );
        post_traccar_command('Send', buffer.join(''));
        console.log(); 

        await keypress();
        // if @cfg_sts#<0x31> <0x01> <0x0D><0x0A>

      }

      console.log("#cfg_write@" );
      buffer = [];
      build_message('#cfg_write@', []).forEach( element => buffer.push( ( '00' + element.toString(16).toUpperCase()).slice(-2)  ) );
      post_traccar_command('Write', buffer.join(''));
      console.log(); 
      await keypress();

      console.log("#cfg_end@"  );
      buffer = [];
      build_message('#cfg_end@', []).forEach( element => buffer.push( ( '00' + element.toString(16).toUpperCase()).slice(-2)  ) );
      post_traccar_command('End', buffer.join(''));
      console.log(); 
      await keypress();
     
     

      exit(0);

    } catch (err) {
      console.log(`There was an error: ${err}`);
    }

  }

  

  //post_traccar_command("GetVersion", "00016717b9");

  readConfigurationFile()
