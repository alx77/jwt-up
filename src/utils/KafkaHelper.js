import cfg from "../common/config.js";
import { Kafka, CompressionTypes, CompressionCodecs } from "kafkajs";
import SnappyCodec from "kafkajs-snappy";

CompressionCodecs[CompressionTypes.Snappy] = SnappyCodec;

let kafkaConfig = {
  clientId: cfg.get("CLIENT_ID"),
  brokers: cfg.get("KAFKA_HOST").split(","),
};
if (cfg.get("KAFKA_SASL_ENABLED"))
  kafkaConfig = {
    ...kafkaConfig,
    sasl: {
      mechanism: "plain", // scram-sha-256 or scram-sha-512
      username: cfg.get("KAFKA_SASL_USERNAME"),
      password: cfg.get("KAFKA_SASL_PASSWORD"),
    },
  };
if (cfg.get("KAFKA_SSL_ENABLED"))
  kafkaConfig = {
    ...kafkaConfig,
    ssl: true,
  };

const kafka = new Kafka(kafkaConfig);

export default {
  producer: kafka.producer(),
  consumer: kafka.consumer({ groupId: cfg.get("KAFKA_CONSUMER_GROUP") }),
  CompressionTypes,
};
