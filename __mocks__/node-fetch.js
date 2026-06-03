const fetch = jest.fn();
fetch.mockResolvedValue({
  json: jest.fn().mockResolvedValue({
    success: true,
    score: 0.9,
    action: null,
  }),
});
module.exports = fetch;
module.exports.default = fetch;
