const exec = async (req, res) => {
  return res
    .status(200)
    .json({
      status: "UP",
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
    })
    .end();
};
export default { exec };
