const urls = [process.env.MUFU_TEST_URL || "https://mufu-mount.vercel.app"];
for (const url of urls) {
  try {
    const r = await fetch(url);
    const text = await r.text();
    console.log(
      JSON.stringify({
        url,
        status: r.status,
        finalUrl: r.url,
        title: text.match(/<title>(.*?)<\/title>/)?.[1],
      }),
    );
    if (r.ok && text.includes("A little further")) {
      for (const path of [
        "/world/scene.json",
        "/world/routes.json",
        "/world/geometry.bin",
        "/audio/forest.mp3",
      ]) {
        const res = await fetch(url + path, { method: "HEAD" });
        console.log(
          JSON.stringify({
            path,
            status: res.status,
            type: res.headers.get("content-type"),
            bytes: res.headers.get("content-length"),
          }),
        );
      }
    }
  } catch (e) {
    console.log(JSON.stringify({ url, error: e.message }));
  }
}
