import api from "@/lib/api";
import { constants } from "./store.js";

export default function fetchConstants() {
  api
    .getConstants()
    .then((json) => {
      constants.set(json.constants.results);
    });
}