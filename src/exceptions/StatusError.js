export default class StatusError extends Error {
  constructor(status, args) {
    super(args);
    this.status = status;
  }
}