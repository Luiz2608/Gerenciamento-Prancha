**Objetivo**
- Remover extração automática de datas (CRLV/Certificado), armazenar apenas o arquivo e a validade informada manualmente.
- Implementar notificações claras de vencimento (expirado/expirando/válido) na tela de Documentos.

**Mudanças de UX (Frontend)**
- Upload com validade manual: adicionar um campo data ao lado do botão Upload tanto para “Documento” quanto “Certificado”. Ao enviar, passar a validade escolhida para o upload.
- Edição posterior: na modal “Ver Detalhes”, incluir um input de data em cada item para editar a validade (salvar via ação existente). 
- Indicadores visuais: manter o badge por documento com cores (vermelho/âmbar/verde) e exibir um resumo no topo: “X vencidos / Y expiram em ≤30 dias”.

**Lógica de Notificação**
- Função utilitária no frontend para calcular status: expired (< hoje), expiring (≤30 dias), valid, unknown (sem validade). Retorna também days_to_expiry.
- Aplicar o cálculo ao listar documentos e após upload/edição para atualizar os badges e o resumo.

**Alterações Técnicas (Frontend)**
- [storageService.js](file:///c:/Users/Luiz%20Eduardo/Documents/trae_projects/Gerenciamento-Prancha/frontend/src/services/storageService.js):
  - uploadTruckDocument: remover tentativas de parse (parseValidityDate/parseIssueDate) e aceitar apenas `expiryDate` vindo do UI. Persistir o arquivo e a validade manual.
  - Adicionar `computeExpiryStatus(date)` para uso offline; devolver `expiry_status` e `days_to_expiry` nos objetos locais.
- [Documents.jsx](file:///c:/Users/Luiz%20Eduardo/Documents/trae_projects/Gerenciamento-Prancha/frontend/src/pages/Documents.jsx):
  - Incluir inputs de data ao lado dos botões Upload.
  - Na modal, permitir editar validade e salvar com `updateTruckDocumentExpiry`.
  - Adicionar o resumo superior com contadores e ícones.

**Alterações Técnicas (Backend, mantendo paridade)**
- [server.js](file:///c:/Users/Luiz%20Eduardo/Documents/trae_projects/Gerenciamento-Prancha/backend/server.js#L424-L476):
  - upload: desativar parse automático; aceitar somente `expiry_date` do cliente. Se ausente, gravar `null`.
  - listagem: manter cálculo de `expiry_status` e `days_to_expiry` para cada item.
  - update: já atualiza `expiry_date`; garantir resposta com campos calculados.

**Compatibilidade com GitHub Pages (Offline)**
- Sem backend: o cálculo de status é feito client-side.
- Armazenamento: manter em `localStorage` (documents) como já existe, agora sem inferência de validade.

**Verificação**
- Caso 1: Upload de Documento com validade preenchida → badge verde/âmbar/vermelho correto e aparece no resumo.
- Caso 2: Upload sem validade → badge “Sem validade/unknown” e aparece no resumo.
- Caso 3: Editar validade na modal → badges e resumo atualizados imediatamente.

**Observações**
- Como solicitado, a extração automática será removida; a validade passará a ser 100% manual.
- O sistema de notificação é visual (badges/resumo) e funciona tanto online quanto no GitHub Pages.
