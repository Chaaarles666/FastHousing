import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "FastHousing",
    short_name: "FastHousing",
    description: "买房不踩坑，决策有底气",
    start_url: "/",
    display: "standalone",
    background_color: "#f8fafc",
    theme_color: "#1e3a5f",
    lang: "zh-CN",
  };
}
