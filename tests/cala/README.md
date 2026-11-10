# Pruebas copiadas de CALA

`unit` e `integration` se ejecutan con `npm run test:cala`. Usan datos sintéticos y las migraciones de esta integración.

Las pruebas originales de `e2e` se conservan como referencia del PMS independiente (sus URL parten de `/`). Para esta aplicación combinada, usa `npm run build && npm run test:browser`: prueba `/admin`, `/api/cala`, Supabase Auth simulado sobre PostgreSQL migrado, escritorio y móvil. El servidor simulado existe solo en `tests/site`, escucha en loopback y no es un modo de la aplicación.
