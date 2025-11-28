import {
  defaultResource,
  resourceFromAttributes,
} from "@opentelemetry/resources";
import { SeverityNumber } from "@opentelemetry/api-logs";
import {
  LoggerProvider,
  BatchLogRecordProcessor,
  ConsoleLogRecordExporter,
} from "@opentelemetry/sdk-logs";
import { OTLPLogExporter } from "@opentelemetry/exporter-logs-otlp-http";
import {
  ATTR_SERVICE_NAME,
  ATTR_SERVICE_VERSION,
} from "@opentelemetry/semantic-conventions";

const resource = defaultResource().merge(
  resourceFromAttributes({
    [ATTR_SERVICE_NAME]: "openai-ui",
    [ATTR_SERVICE_VERSION]: import.meta.env.VITE_VERSION || "0.0.0",
  })
);

const collectorOptions = {
  url: "https://otlp.fh-swf.cloud/v1/logs", // url is optional and can be omitted - default is http://localhost:4318/v1/logs
  headers: {}, // an optional object containing custom headers to be sent with each request
  concurrencyLimit: 1, // an optional limit on pending requests
};

const logExporter = new OTLPLogExporter(collectorOptions);

const loggerProvider = new LoggerProvider({
  resource,
  logRecordLimits: {
    attributeCountLimit: 100,
    attributeValueLengthLimit: 1000,
  },
});

loggerProvider.addLogRecordProcessor(new BatchLogRecordProcessor(logExporter));

export const logger = loggerProvider.getLogger(
  "openai_ui",
  import.meta.env.VITE_VERSION || "0.0.0"
);

export { SeverityNumber };
