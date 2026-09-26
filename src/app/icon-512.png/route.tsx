import { renderIcon } from "@/lib/renderIcon";

export const dynamic = "force-static";

export function GET() {
  return renderIcon(512);
}
