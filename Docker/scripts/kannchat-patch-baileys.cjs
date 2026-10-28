// KannChat — corrige o reenvio (retry) do Baileys 7.0.0-rc.9 antes do build.
//
// Quando um aparelho não decifra uma mensagem e pede reenvio, o
// `relayMessage` cifra a mensagem DUAS vezes para ele: uma em
// `createParticipantNodes` (nó <participants>) e outra no bloco
// `if (isRetryResend)` (<enc> solto). O servidor recusa o stanza com
// 479 (smax-invalid), a Evolution emite ERROR, e a cifragem dupla avança o
// Double Ratchet dois passos — a sessão com aquele aparelho dessincroniza e o
// envio seguinte falha também. Em grupo é pior: o retry de grupo cai no ramo
// de 1:1 (`if (isGroupOrStatus && !isRetryResend)`), então todo pedido de
// reenvio de membro de grupo passa por aqui.
//
// Upstream: WhiskeySockets/Baileys#2781 (aberta; o rc14 ainda tem o bug).
// KannChat: agenciakann/kannchat#284.
//
// O conserto: no reenvio, não monta os nós de participante — fica só a
// cifragem do bloco de retry, uma vez, como no WhatsApp Web. A sessão com o
// aparelho já foi garantida antes por `sendMessagesAgain`
// (`assertSessions([participant], true)`).
//
// Falha o build se o trecho não estiver exatamente como esperado: atualizar o
// Baileys exige revisar este patch, não passar por cima dele.

const fs = require('fs');
const path = require('path');

const ESPERADA = '7.0.0-rc.9';
const raiz = path.join(__dirname, '..', '..', 'node_modules', 'baileys');
const arquivo = path.join(raiz, 'lib', 'Socket', 'messages-send.js');

const versao = JSON.parse(fs.readFileSync(path.join(raiz, 'package.json'), 'utf8')).version;
if (versao !== ESPERADA) {
  console.error(`kannchat-patch-baileys: baileys ${versao}, patch feito para ${ESPERADA}. Revise o patch.`);
  process.exit(1);
}

const ANTES = [
  '                    createParticipantNodes(meRecipients, meMsg || message, extraAttrs),',
  '                    createParticipantNodes(otherRecipients, message, extraAttrs, meMsg)',
].join('\n');
const DEPOIS = [
  '                    // KannChat (#284): no reenvio, a cifragem é só a do bloco isRetryResend',
  '                    createParticipantNodes(isRetryResend ? [] : meRecipients, meMsg || message, extraAttrs),',
  '                    createParticipantNodes(isRetryResend ? [] : otherRecipients, message, extraAttrs, meMsg)',
].join('\n');

const fonte = fs.readFileSync(arquivo, 'utf8');
if (fonte.includes('KannChat (#284)')) {
  console.log('kannchat-patch-baileys: já aplicado');
  process.exit(0);
}
const ocorrencias = fonte.split(ANTES).length - 1;
if (ocorrencias !== 1) {
  console.error(`kannchat-patch-baileys: trecho esperado aparece ${ocorrencias}x em messages-send.js (devia ser 1).`);
  process.exit(1);
}
fs.writeFileSync(arquivo, fonte.replace(ANTES, DEPOIS));
console.log(`kannchat-patch-baileys: retry sem cifragem dupla aplicado (baileys ${versao})`);
