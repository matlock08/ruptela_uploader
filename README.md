# Ruptela Uploader

This projects allows to upload configuration files fa5c from ruptela GPS tracker into [traccar](https://www.traccar.org) software by 
leveraging the traccar api. It requieres to allow event forwarding from traccar into the server url where this app is running to listen 
the event emitted by traccar so it recognizes the current state.

This is a concept project and if yopu plan to use it , is at your own risk,

## Traccar Integration Event Foward

Below is the sequence diagram between Ruptela Uploader and traccar. The calls from Ruptela Uploader to raccar are rest api calls to traccar api, and the event forwading are the events emmited by traccar and redirected to Ruptela Uploader.

[![](https://mermaid.ink/img/pako:eNrNUz1rAzEM_StGa3Mc6egh3NB0bcnHZijC1qWGs32V5YYQ8t_rcJelazJEk0DvPR5P0hlscgQaMv0UipbePB4Yg4mq1qaMQgOq_TgkdMTNavWyY7QWWavPj-1OtTj61qYQMLrcZopO2f7wlQVZuklkJjSV3PwX1Gr9S1HUe-IjcuVOShvKZRDVTVJZLU2811BtuuUjDd1v5_WJ8jmyF3qmhV0DevS6bgULCMQBvauHf77ODMg3BTKga-uox0o3YOKlQsvoUGjtvCQG3eOQaQFYJG1P0YIWLnQDzc8zoy5_WhImqQ)](https://mermaid.live/edit#pako:eNrNUz1rAzEM_StGa3Mc6egh3NB0bcnHZijC1qWGs32V5YYQ8t_rcJelazJEk0DvPR5P0hlscgQaMv0UipbePB4Yg4mq1qaMQgOq_TgkdMTNavWyY7QWWavPj-1OtTj61qYQMLrcZopO2f7wlQVZuklkJjSV3PwX1Gr9S1HUe-IjcuVOShvKZRDVTVJZLU2811BtuuUjDd1v5_WJ8jmyF3qmhV0DevS6bgULCMQBvauHf77ODMg3BTKga-uox0o3YOKlQsvoUGjtvCQG3eOQaQFYJG1P0YIWLnQDzc8zoy5_WhImqQ)

First you need to enable the events forwad from traccar into your application by adding below lines into the traccar.xml 

```
    <entry key='event.forward.enable'>true</entry>
    <entry key='event.forward.url'>http://your.domain/traccar_events</entry>
```


## Traccar Integration Ruptela Uploader user

You need to create a config file in config/default.json using below as a template

```
{
    "server": {
        "traccar_host": "traccar.instance",
        "traccar_port": 443,
        "traccar_protocol": "https",
        "traccar_authorization": "Basic YWRtaW46YWRtaW4=",
        "local_upload_dir": "./files",
        "local_port": 9090
    }
}
```

traccar.instance is the url of your traccar instance
traccar authorization is the http header used to authenticate in traccar, is a base 64 encode string user:passwrd (in this example is admin:admin)
local_upload_dir is the local directory used by ruptela uploader to hold the files it will upload to traccar

## Ruptela Uploader running

First you need to install node js 10.x as well as the dependencies with npm install, once you have dependencies run with traditional npm start

## Pending Work

The current implementation allows to upload configuration, and even when downloading is possible , we need to implement a change on traccar as currently 
the commandResult is exposed as string, and the hexadecimal values got lost, so we might need to change traccar code to allow us to read the values in result as hexadecimals and not strings.

 [X] Upload configuration
 [ ] Download current config

