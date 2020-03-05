#!/usr/bin/env bash
docker-compose -f docker-compose.mongo.yml \
    -f docker-compose.graylog.yml \
    -f docker-compose.grafana.yml \
    up -d

DOCKER_RUNNING_INSTANCES=1
while :; do
    DOCKER_RUNNING_INSTANCES=$(docker ps | grep 'health' | grep -vE 'healthy' | wc -l)
    ((DOCKER_RUNNING_INSTANCES > 0)) || break
    echo "waiting for healthy instances...$DOCKER_RUNNING_INSTANCES"
    sleep 3
done

grafana_creds="admin:secret"
DSID=$(curl -X POST --silent -H "Accept: application/json" \
    -H "Content-Type: application/json" \
    -H "Authorization: Basic $(echo -n $grafana_creds | base64)" \
    -d "{\"name\":\"InfluxDB\",\"type\":\"influxdb\",\"typeLogoUrl\":\"public/app/plugins/datasource/influxdb/img/influxdb_logo.svg\",\"access\":\"direct\",\"url\":\"http://localhost:8086\",\"password\":\"secret\",\"user\":\"telegraf\",\"database\":\"telegraf\",\"basicAuth\":false,\"isDefault\":true,\"jsonData\":{\"httpMode\":\"GET\"}}" \
    http://localhost:3000/api/datasources | jq -rc ."datasource"."id")

curl -X POST --silent -H "Accept: application/json" \
    -H "Content-Type: application/json" \
    -H "Authorization: Basic $(echo -n $grafana_creds | base64)" \
    -d "{\"dashboard\":{\"annotations\":{\"list\":[{\"builtIn\":1,\"datasource\":\"-- Grafana --\",\"enable\":true,\"hide\":true,\"iconColor\":\"rgba(0, 211, 255, 1)\",\"name\":\"Annotations & Alerts\",\"type\":\"dashboard\"}]},\"editable\":true,\"gnetId\":null,\"graphTooltip\":0,\"id\":null,\"links\":[],\"panels\":[{\"aliasColors\":{},\"bars\":false,\"dashLength\":10,\"dashes\":false,\"datasource\":null,\"fill\":1,\"fillGradient\":0,\"gridPos\":{\"h\":7,\"w\":24,\"x\":0,\"y\":0},\"hiddenSeries\":false,\"id\":2,\"legend\":{\"avg\":false,\"current\":false,\"max\":false,\"min\":false,\"show\":true,\"total\":false,\"values\":false},\"lines\":true,\"linewidth\":1,\"nullPointMode\":\"null as zero\",\"options\":{\"dataLinks\":[]},\"percentage\":false,\"pointradius\":2,\"points\":false,\"renderer\":\"flot\",\"seriesOverrides\":[],\"spaceLength\":10,\"stack\":false,\"steppedLine\":false,\"targets\":[{\"groupBy\":[{\"params\":[\"\$__interval\"],\"type\":\"time\"},{\"params\":[\"null\"],\"type\":\"fill\"}],\"measurement\":\"status_code_200\",\"orderByTime\":\"ASC\",\"policy\":\"default\",\"refId\":\"A\",\"resultFormat\":\"time_series\",\"select\":[[{\"params\":[\"value\"],\"type\":\"field\"},{\"params\":[],\"type\":\"mean\"}]],\"tags\":[]}],\"thresholds\":[],\"timeFrom\":null,\"timeRegions\":[],\"timeShift\":null,\"title\":\"Panel Title\",\"tooltip\":{\"shared\":true,\"sort\":0,\"value_type\":\"individual\"},\"type\":\"graph\",\"xaxis\":{\"buckets\":null,\"mode\":\"time\",\"name\":null,\"show\":true,\"values\":[]},\"yaxes\":[{\"format\":\"short\",\"label\":null,\"logBase\":1,\"max\":null,\"min\":null,\"show\":true},{\"format\":\"short\",\"label\":null,\"logBase\":1,\"max\":null,\"min\":null,\"show\":true}],\"yaxis\":{\"align\":false,\"alignLevel\":null}}],\"refresh\": \"5s\",\"schemaVersion\":21,\"style\":\"dark\",\"tags\":[],\"templating\":{\"list\":[]},\"time\":{\"from\":\"now-1h\",\"to\":\"now\"},\"timepicker\":{},\"timezone\":\"\",\"title\":\"status200\",\"uid\":\"iX7s2KYWz\",\"version\":3},\"overwrite\":true,\"inputs\":[],\"folderId\":0}" \
    http://localhost:3000/api/dashboards/import

SESSION_ID=$(curl -X POST --silent -H "Accept: application/json" \
    -H "Content-Type: application/json" \
    -H "X-Requested-By: XMLHttpRequest" \
    -d "{\"username\":\"admin\",\"password\":\"admin\",\"host\":\"localhost:9000\"}" \
    http://127.0.0.1:9000/api/system/sessions | jq -rc ."session_id")

EXISTS=$(curl -X GET --silent -H "Accept: application/json" \
    -H "Content-Type: application/json" \
    -H "X-Requested-By: XMLHttpRequest" \
    -H "Authorization: Basic $(echo -n ${SESSION_ID}:session | base64)" \
    http://127.0.0.1:9000/api/cluster/inputstates | jq -rc '.[][0].message_input.title=="Gelf UDP"')

if [[ $EXISTS != "true" ]]; then
    curl -X POST --silent -H "Accept: application/json" \
        -H "Content-Type: application/json" \
        -H "X-Requested-By: XMLHttpRequest" \
        -H "Authorization: Basic $(echo -n ${SESSION_ID}:session | base64)" \
        -d "{\"title\":\"Gelf UDP\",\"type\":\"org.graylog2.inputs.gelf.udp.GELFUDPInput\",\"configuration\":{\"bind_address\":\"0.0.0.0\",\"port\":12201,\"recv_buffer_size\":262144,\"number_worker_threads\":4,\"override_source\":null,\"decompress_size_limit\":8388608},\"global\":true}" \
        http://127.0.0.1:9000/api/system/inputs
fi
