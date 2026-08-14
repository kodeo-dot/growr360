// Vercel sirve directamente la exportación de Next.js. El hosting temporal de
// Sites requiere, en cambio, empaquetar los archivos y el worker en otra forma.
if (process.env.VERCEL === "1") {
  console.log("Build de Vercel detectado: se conserva la salida estática de Next.js.");
} else {
  await import("./prepare-sites.mjs");
}
