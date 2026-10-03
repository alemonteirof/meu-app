// Datas "do dia" no fuso LOCAL do navegador.
// Não use new Date().toISOString().slice(0, 10) para isso: toISOString é UTC,
// e no Brasil (UTC-3) depois das 21h já devolve o dia seguinte.
// (toISOString continua certo para timestamp completo: updated_at, assinaturas etc.)

/** Date → 'AAAA-MM-DD' pelo calendário local. */
export function dataLocalISO(d) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

/** Hoje em 'AAAA-MM-DD' (data local). */
export function hojeLocal() {
  return dataLocalISO(new Date());
}
