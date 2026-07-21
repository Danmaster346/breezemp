// MCP-сервер Kupiks: инструменты работают от имени вошедшего пользователя
// через Supabase OAuth (RLS применяется как для этого пользователя).
import { auth, defineMcp } from "@lovable.dev/mcp-js";
import whoamiTool from "./tools/whoami";
import searchCatalogTool from "./tools/search-catalog";
import getProductTool from "./tools/get-product";
import listMyOrdersTool from "./tools/list-my-orders";
import listMyProductsTool from "./tools/list-my-products";
import listMyFavoritesTool from "./tools/list-my-favorites";

// На публикации SUPABASE_URL перезаписывается в .lovable.cloud прокси, но
// mcp-js отвергает такой issuer (RFC 8414). Собираем прямой supabase.co URL
// из literal, который Vite инлайнит в билд.
const projectRef = import.meta.env.VITE_SUPABASE_PROJECT_ID ?? "project-ref-unset";

export default defineMcp({
  name: "kupiks-mcp",
  title: "Kupiks",
  version: "0.1.0",
  instructions:
    "Инструменты маркетплейса Kupiks. Работают от имени вошедшего пользователя. `search_catalog` и `get_product` — публичные; `list_my_orders`, `list_my_products`, `list_my_favorites`, `whoami` требуют авторизации.",
  auth: auth.oauth.issuer({
    issuer: `https://${projectRef}.supabase.co/auth/v1`,
    acceptedAudiences: "authenticated",
  }),
  tools: [
    whoamiTool,
    searchCatalogTool,
    getProductTool,
    listMyOrdersTool,
    listMyProductsTool,
    listMyFavoritesTool,
  ],
});
