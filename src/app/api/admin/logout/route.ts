import { POST as session } from "@/app/api/cala/session/route";
export async function POST(request: Request) { return session(new Request(request.url, {method:"POST", headers:request.headers, body:JSON.stringify({action:"logout"})})); }
