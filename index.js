const express = require("express");
const bodyParser = require("body-parser");
const app = express();
const { Cluster } = require("puppeteer-cluster");
const gracefulShutdown = require("http-graceful-shutdown");

app.use(bodyParser.json());

(async () => {
  const cluster = await Cluster.launch({
    concurrency: Cluster.CONCURRENCY_CONTEXT,
    maxConcurrency: process.env.maxConcurrency || 2,
    puppeteerOptions: {
      args: ["--no-sandbox", "--disable-setuid-sandbox"],
    },
  });
  await cluster.task(async ({ page, data }) => {
    if (data.html) {
      await page.setContent(data.html);
    } else {
      await page.goto(data.url, {
        waitUntil: "networkidle0", // wait for page to load completely
      });
    }
    const pdf = await page.pdf(data.options);
    return pdf;
  });

  // setup server
  app.post("/", async function (req, res) {
    const data = req.body;
    try {
      const pdf = await cluster.execute(data);

      // respond with pdf
      res.writeHead(200, {
        "Content-Type": "application/pdf",
        "Content-Length": pdf.length,
      });
      res.end(pdf);
    } catch (err) {
      // catch error
      res.end("Error: " + err.message);
    }
  });

  gracefulShutdown(app.listen(process.env.PORT || 3000));
})();
