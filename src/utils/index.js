function jsonEscape(json) {
  return (
    (typeof json == "string" &&
      json
        .replace(/[\\]/g, "\\\\")
        .replace(/[\/]/g, "\\/")
        .replace(/[\b]/g, "\\b")
        .replace(/[\f]/g, "\\f")
        .replace(/[\n]/g, "\\n")
        .replace(/[\r]/g, "\\r")
        .replace(/[\t]/g, "\\t")
        .replace(/[\"]/g, '\\"')
        .replace(/\\'/g, "\\'")) ||
    json
  );
}

function pager({ page, size }) {
  return { limit: size, offset: size * page };
}

module.exports = { jsonEscape, pager };
