const QueryError = exports.BizError = class QueryError extends Error {
  constructor(message, status = 400) {
    super(message); // (1)
    this.status = status;
  }
}
