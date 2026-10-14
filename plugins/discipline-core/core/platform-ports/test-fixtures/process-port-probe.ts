import { createProcessPort } from "../process-port.ts";

const port = createProcessPort({});
port.writeOut({ text: JSON.stringify(port.arguments) });
port.exitWith({ code: 2 });
