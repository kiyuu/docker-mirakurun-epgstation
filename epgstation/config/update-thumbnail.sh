#! /bin/sh

curl -sX DELETE http://localhost:8888/api/thumbnails/$(curl -sX GET http://localhost:8888/api/recorded/$RECORDEDID?isHalfWidth=true | jq .thumbnails[0])
curl -sX POST http://localhost:8888/api/thumbnails/videos/$VIDEOFILEID
