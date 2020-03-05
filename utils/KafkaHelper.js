const cfg = require("../common/config");
const { Kafka, CompressionTypes, CompressionCodecs } = require("kafkajs");
const SnappyCodec = require("kafkajs-snappy");

CompressionCodecs[CompressionTypes.Snappy] = SnappyCodec;

const kafka = new Kafka({
  clientId: cfg.get("CLIENT_ID"),
  brokers: cfg.get("KAFKA_HOST").split(",")
});

module.exports = {
  producer: kafka.producer(),
  consumer: kafka.consumer({ groupId: "test-group" })
};
