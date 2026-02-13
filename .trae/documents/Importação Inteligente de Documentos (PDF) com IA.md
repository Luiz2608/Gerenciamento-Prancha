## Objetivo
Automatizar a importação e classificação de documentos (PDF) de caminhões com IA (DeepSeek), extraindo placa, chassi, ano, tipo, datas de emissão/validade e integrando com as abas Caminhões e Tacógrafos & Documentos, mantendo revisão humana antes de salvar.

## Pontos de Integração Existentes
- Upload e metadados de documentos: storageService
  - getDocumentosByCaminhao, upload, edição de validade, remoção e status de vencimento: [storageService.js](file:///c:/Users/Luiz%20Eduardo/Documents/trae_projects/Gerenciamento-Prancha/frontend/src/services/storageService.js#L1454-L1622)
- UI de Documentos/Tacógrafos: inputs e fluxo de upload já existem: [Documents.jsx](file:///c:/Users/Luiz%20Eduardo/Documents/trae_projects/Gerenciamento-Prancha/frontend/src/pages/Documents.jsx)
- Backend para upload físico (API_URL): rotas e armazenamento local: [server.js](file:///c:/Users/Luiz%20Eduardo/Documents/trae_projects/Gerenciamento-Prancha/backend/server.js#L424-L493)
- Status de validade: computeExpiryStatus padronizado: [storageService.js:L297-L314](file:///c:/Users/Luiz%20Eduardo/Documents/trae_projects/Gerenciamento-Prancha/frontend/src/services/storageService.js#L297-L314) <mccoremem id="01KEEMSKE7XKDZ62KP0HC3AFYP"/>

## Arquitetura da Solução
- Backend
  - Criar endpoint /api/ai/extract-document que recebe o documento (id/caminho, ou base64) e retorna JSON com campos extraídos, confiabilidade e observações.
  - Pipeline de extração:
    1) Extrair texto com pdf.js (PDFs digitais).
    2) Fallback OCR (Tesseract) para PDFs escaneados.
    3) Pós-processar com DeepSeek (LLM) para estruturar: placa, chassi, ano, tipo, datas (emitido/validade). Incluir normalização e confidence.
    4) Fallback regex local para datas e ano (paridade offline/online). <mccoremem id="01KEEMSKE7XKDZ62KP0HC3AFYP"/>
  - Provedor IA: módulo adaptador (DeepSeek por padrão), chave e URL apenas no servidor.
- Frontend
  - Documents.jsx: após upload, chamar /api/ai/extract-document e abrir um modal de Revisão Inteligente com os dados extraídos.
  - FleetTrucks.jsx: adicionar botão Importar Documento com o mesmo fluxo; se não houver caminhão correspondente, permitir criação automática.

## Fluxo de Usuário
1) Upload do PDF (em Documentos/Tacógrafos ou Caminhões).
2) IA processa e pré-preenche: placa, chassi, ano, tipo, emissão, validade.
3) Perguntas inteligentes (quando necessário):
   - “Qual a frota vinculada a este documento?”
   - “Deseja salvar as informações extraídas no cadastro do caminhão e no controle de tacógrafos?”
4) Revisão/edição manual pelo usuário; exibir alertas de inconsistência.
5) Confirmação: aplicar atualizações em Caminhões e registrar documento e validade em Tacógrafos & Documentos.

## Extração (PDF/OCR + DeepSeek)
- Estratégia híbrida:
  - Texto direto (pdf.js) → parse heurístico (regex) e LLM para classificar tipo de documento.
  - OCR (Tesseract) apenas quando necessário.
- Campos retornados (JSON): { plate, chassis, year, doc_type, issue_date, expiry_date, confidence, notes }
- Datas: sugeridas pela IA, nunca salvas sem confirmação. <mccoremem id="03fl0g7hde1xah1yslay2ooc0|01KGMNQ7C931Y4YRX6063Q9KE7"/>

## Mapeamento e Persistência
- Caminhões
  - Buscar por placa/chassi: se existir, atualizar campos ausentes (modelo/ano/chassi/frota se informado).
  - Se não existir, criar novo registro com dados extraídos.
- Documentos/Tacógrafos
  - Vincular documento ao truck_id; definir type: "documento" ou "tacografo_certificado" conforme doc_type.
  - Registrar expiry_date (após confirmação) e exibir status via computeExpiryStatus.

## Validações e Consistência
- Checagens: placa extraída vs caminhão selecionado; frota informada vs cadastro; ano fora de faixa; chassi inválido.
- Alertas e sugestões: usuário decide antes de salvar.
- Datas em dd/mm/yyyy na UI; armazenamento ISO (YYYY-MM-DD). <mccoremem id="03fl0g7hde1xah1yslay2ooc0|01KGMNQ7C931Y4YRX6063Q9KE7|01KEEMSKE7XKDZ62KP0HC3AFYP"/>

## UI Alterações
- Documents.jsx
  - Modal “Revisão de Documento”: formulário compacto com campos extraídos, badges de confiabilidade, e duas opções de salvamento (Caminhões e Tacógrafos).
  - Perguntas smart com selects/textos.
- FleetTrucks.jsx
  - Botão “Importar Documento” com o mesmo modal.

## Offline e Fallback
- Sem API/IA: usar heurísticas regex existentes para datas (emitido/validade) e ano, mantendo revisão manual e sem automação crítica. <mccoremem id="01KEEMSKE7XKDZ62KP0HC3AFYP|03fl0g7hde1xah1yslay2ooc0"/>

## Configuração e Segurança
- Chave/endpoint DeepSeek apenas no backend (dotenv), nunca exposta no frontend.
- Limites: tamanho de arquivo, tipos permitidos e sanitização.
- Logs: warnings para quedas de serviço; sem gravação de PDFs em logs.

## Entregáveis
- Endpoint /api/ai/extract-document (backend) com adaptador DeepSeek + pdf.js/Tesseract.
- Modal de Revisão Inteligente e chamada ao endpoint (frontend).
- Integração com storageService para salvar/atualizar caminhões e documentos.
- Validações, formatação de datas e alertas de inconsistência conforme regras.

## Aprovação
Confirma que seguimos com esta arquitetura (IA no backend com DeepSeek, extração híbrida, revisão manual antes de persistir, integração em Documents.jsx e FleetTrucks.jsx)?