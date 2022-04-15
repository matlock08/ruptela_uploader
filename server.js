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
const express = require('express');
const multer = require("multer");
const events = require('events');
const config = require('config');
const uploader = require('./ruptela_uploader.js');

const app = express();
const port = config.get('server.local_port');


app.use(express.json());
// Procesar el formato x-www-form-urlencoded
app.use(express.urlencoded({
    extended:true
}));

const myEmitter = new events.EventEmitter();
const cc = new uploader.RuptelaUploader(config.get('server.traccar_host'), 
                                            config.get('server.traccar_port'), 
                                            config.get('server.traccar_authorization'), 
                                            myEmitter);

// instancia de multer
const upload = multer({
    // Dirección de directorio almacenada
    dest: config.get('server.local_upload_dir')
});


/**
 * Listens for the event scomming from traccar, so we can identify the different states of the device we are updating
 */
app.all('/traccar_events', (req, res) => {
    var event = null;
    var device = null;
    var users = [];

    req.body.hasOwnProperty('event') ? event = req.body.event : event = null;
    req.body.hasOwnProperty('device') ? device = req.body.device : device = null;
    req.body.hasOwnProperty('users') ? users = req.body.users : users = [];
        
    if ( event != null && device != null ) {
        //console.log("Event " + event.type );
        myEmitter.emit( event.type, req.body );
    }

    res.send('OK');
})




app.post('/configuration', upload.single("file") , (req, res) => {
    cc.sendConfigurationFile(req.body.device, req.file.path );
    res.status(202).send({ message: 'Message accepted' });    
})

app.get('/configuration', (req, res) => {
    cc.readConfigurationFile(req.query.device);
    res.status(202).send({ message: 'Message accepted' });    
})

app.listen(port, () => {
  console.log(`Connector listening at http://localhost:${port}`)
})