/**
 * Preload script — cargado via NODE_OPTIONS=--require ./firebase-admin-preload.js
 *
 * Turbopack (Next.js 15+/16) añade un content-hash al nombre de los paquetes
 * listados en serverExternalPackages, produciendo require("firebase-admin-<hex16>").
 * En Cloud Run no existe ningún paquete con ese nombre, por lo que TODAS las
 * rutas dinámicas devuelven 500.
 *
 * Este script parchea Module._load ANTES de que se cargue cualquier módulo,
 * redirigiendo cualquier require("firebase-admin-<hex16>") al paquete real.
 */
'use strict';

const Module = require('module');
const _original = Module._load.bind(Module);

Module._load = function patchedLoad(request, parent, isMain) {
  const m = /^firebase-admin-[0-9a-f]{16}(\/.*)?$/.exec(request);
  if (m) {
    const subpath = m[1] || '';
    return _original('firebase-admin' + subpath, parent, isMain);
  }
  return _original(request, parent, isMain);
};
