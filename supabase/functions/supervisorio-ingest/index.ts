// Edge Function: recebe estado e eventos do gateway do supervisório (Raspberry Pi no cliente).
// O gateway se identifica pelo cabeçalho "x-gateway-token"; aqui só existe o sha256 do token
// (supervisorio_gateways.token_hash). Grava com a service role, então as tabelas não precisam
// de política de escrita para usuários. Publicar com verify_jwt = false (o gateway não tem login).
import { createClient } from "jsr:@supabase/supabase-js@2";

const supabase = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
);

const TIPOS_DO_GATEWAY = new Set(["INICIO", "ONLINE", "OFFLINE"]);
const MAX_EVENTOS = 200;

async function sha256(texto: string): Promise<string> {
  const dig = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(texto));
  return Array.from(new Uint8Array(dig)).map((b) => b.toString(16).padStart(2, "0")).join("");
}

const corta = (v: unknown, max: number) => (typeof v === "string" ? v.slice(0, max) : null);
const inteiro = (v: unknown) => (Number.isInteger(v) ? (v as number) : null);
const resposta = (status: number, corpo: unknown) =>
  new Response(JSON.stringify(corpo), { status, headers: { "Content-Type": "application/json" } });

Deno.serve(async (req) => {
  if (req.method !== "POST") return resposta(405, { erro: "use POST" });

  const token = req.headers.get("x-gateway-token") ?? "";
  if (token.length < 32) return resposta(401, { erro: "token ausente" });

  const { data: gw, error: erroGw } = await supabase
    .from("supervisorio_gateways")
    .select("id, cliente_id, painel_id")
    .eq("token_hash", await sha256(token))
    .maybeSingle();
  if (erroGw) return resposta(500, { erro: "falha ao validar gateway" });
  if (!gw) return resposta(401, { erro: "gateway desconhecido" });

  let corpo: { versao?: string; estado?: Record<string, unknown> | null; eventos?: unknown[] };
  try {
    corpo = await req.json();
  } catch {
    return resposta(400, { erro: "JSON inválido" });
  }

  const eventos = Array.isArray(corpo.eventos) ? corpo.eventos.slice(0, MAX_EVENTOS) : [];
  if (eventos.length > 0) {
    const linhas = eventos.map((e) => {
      const ev = e as Record<string, unknown>;
      const tipo = corta(ev.tipo, 30) ?? "DESCONHECIDO";
      const quando = new Date(String(ev.dataHora ?? ""));
      return {
        cliente_id: gw.cliente_id,
        painel_id: gw.painel_id,
        gateway_id: gw.id,
        data_hora: isNaN(quando.getTime()) ? new Date().toISOString() : quando.toISOString(),
        tipo,
        texto: corta(ev.texto, 300) ?? "",
        detalhe: corta(ev.detalhe, 600),
        origem: TIPOS_DO_GATEWAY.has(tipo) ? "gateway" : "painel",
      };
    });
    const { error } = await supabase.from("supervisorio_eventos").insert(linhas);
    if (error) return resposta(500, { erro: "falha ao gravar eventos" });
  }

  const s = corpo.estado;
  if (s && gw.painel_id) {
    const { error } = await supabase.from("supervisorio_estado").upsert({
      painel_id: gw.painel_id,
      cliente_id: gw.cliente_id,
      gateway_id: gw.id,
      online: s.online === true,
      alarmes: inteiro(s.alarmes),
      falhas: inteiro(s.falhas),
      desativacoes: inteiro(s.desativacoes),
      silenciado: s.silenciado === true,
      acesso2: s.acesso2 === true,
      leds: corta(s.leds, 40),
      tela: Array.isArray(s.tela) ? s.tela.slice(0, 12).map((l) => String(l).slice(0, 60)) : null,
      atualizado_em: new Date().toISOString(),
    });
    if (error) return resposta(500, { erro: "falha ao gravar estado" });
  }

  await supabase
    .from("supervisorio_gateways")
    .update({ ultimo_contato: new Date().toISOString(), versao: corta(corpo.versao, 20) })
    .eq("id", gw.id);

  return resposta(200, { ok: true, eventos: eventos.length });
});
