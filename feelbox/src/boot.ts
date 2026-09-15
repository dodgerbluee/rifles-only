import "./style.css";
import { GL_BOOT_ERROR, showBootError, startLobby } from "./lobby";

startLobby();
import("./main").catch((err) => {
  console.error(err);
  showBootError(GL_BOOT_ERROR);
});
