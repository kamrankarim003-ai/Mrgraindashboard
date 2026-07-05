import "dotenv/config";
import { createApp } from "./app";
import { startCronJobs } from "./utils/cron";

const port = Number(process.env.PORT || 4000);

const app = createApp();

app.listen(port, () => {
  console.log(`MR GRAIN backend listening on port ${port}`);
  startCronJobs();
});
