window.RochePlugin.register({
  id: "roche-memory-checker",
  name: "Roche 记忆体检助手",
  version: "1.0.1",
  apps: [
    {
      id: "memory-checker-home",
      name: "体检助手",
      icon: "extension",
      async mount(container, roche) {
        container.innerHTML = `
          <style>
            .roche-plugin-memory-checker {
              padding: 18px;
              font-family: system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
              color: #222;
              line-height: 1.55;
            }
            .roche-plugin-memory-checker * {
              box-sizing: border-box;
            }
            .rmc-title {
              font-size: 22px;
              font-weight: 700;
              margin-bottom: 6px;
            }
            .rmc-subtitle {
              font-size: 13px;
              color: #777;
              margin-bottom: 16px;
            }
            .rmc-card {
              background: #f7f7f7;
              border: 1px solid #e5e5e5;
              border-radius: 16px;
              padding: 14px;
              margin-bottom: 14px;
            }
            .rmc-label {
              display: block;
              font-size: 13px;
              color: #666;
              margin-bottom: 6px;
            }
            .rmc-select {
              width: 100%;
              padding: 11px 12px;
              border-radius: 12px;
              border: 1px solid #ddd;
              background: white;
              font-size: 15px;
              margin-bottom: 12px;
            }
            .rmc-btn-row {
              display: flex;
              gap: 10px;
              flex-wrap: wrap;
            }
            .rmc-btn {
              appearance: none;
              border: none;
              border-radius: 14px;
              padding: 12px 14px;
              font-size: 15px;
              font-weight: 650;
              background: #222;
              color: white;
              cursor: pointer;
              min-width: 120px;
            }
            .rmc-btn.secondary {
              background: #eeeeee;
              color: #222;
            }
            .rmc-btn:disabled {
              opacity: 0.45;
              cursor: not-allowed;
            }
            .rmc-status {
              font-size: 13px;
              color: #666;
              margin-top: 10px;
              white-space: pre-wrap;
            }
            .rmc-summary {
              font-size: 14px;
              color: #333;
              white-space: pre-wrap;
            }
            .rmc-result {
              background: #111;
              color: #f5f5f5;
              border-radius: 16px;
              padding: 14px;
              white-space: pre-wrap;
              font-size: 14px;
              line-height: 1.65;
              min-height: 160px;
              overflow: auto;
            }
          </style>

          <div class="roche-plugin-memory-checker">
            <div class="rmc-title">Roche 记忆体检助手</div>
            <div class="rmc-subtitle">只读取资料和给建议，不会自动写入主记忆。</div>

            <div class="rmc-card">
              <label class="rmc-label">选择要体检的角色</label>
              <select id="rmcCharacterSelect" class="rmc-select">
                <option value="">正在读取角色列表...</option>
              </select>

              <div class="rmc-btn-row">
                <button id="rmcLoadData" class="rmc-btn">加载数据</button>
                <button id="rmcAnalyze" class="rmc-btn secondary" disabled>AI 分析建议</button>
              </div>

              <div id="rmcStatus" class="rmc-status"></div>
            </div>

            <div class="rmc-card">
              <b>已加载内容</b>
              <div id="rmcSummary" class="rmc-summary">还没有加载。</div>
            </div>

            <div class="rmc-card">
              <b>分析结果</b>
              <div id="rmcResult" class="rmc-result">点“加载数据”后，再点“AI 分析建议”。</div>
            </div>
          </div>
        `;

        const selectEl = container.querySelector("#rmcCharacterSelect");
        const loadBtn = container.querySelector("#rmcLoadData");
        const analyzeBtn = container.querySelector("#rmcAnalyze");
        const statusEl = container.querySelector("#rmcStatus");
        const summaryEl = container.querySelector("#rmcSummary");
        const resultEl = container.querySelector("#rmcResult");

        let characters = [];
        let currentData = null;

        function safeText(value) {
          if (value === null || value === undefined) return "";
          if (typeof value === "string") return value;
          try {
            return JSON.stringify(value, null, 2);
          } catch (e) {
            return String(value);
          }
        }

        function countValue(value) {
          if (!value) return 0;
          if (Array.isArray(value)) return value.length;
          if (typeof value === "string") return value.trim() ? 1 : 0;
          if (typeof value === "object") return Object.keys(value).length;
          return 1;
        }

        async function loadCharacters() {
          try {
            characters = await roche.character.list();

            if (!characters || characters.length === 0) {
              selectEl.innerHTML = `<option value="">没有读取到角色</option>`;
              statusEl.textContent = "没有读取到角色。";
              return;
            }

            selectEl.innerHTML = characters.map((char) => {
              const name = char.handle || char.name || char.displayName || char.id;
              return `<option value="${char.id}">${name}</option>`;
            }).join("");

            statusEl.textContent = "角色列表已读取。";
          } catch (err) {
            selectEl.innerHTML = `<option value="">读取失败</option>`;
            statusEl.textContent = "读取角色列表失败：" + (err && err.message ? err.message : err);
          }
        }

        loadBtn.onclick = async () => {
          const charId = selectEl.value;
          if (!charId) {
            statusEl.textContent = "请先选择一个角色。";
            return;
          }

          try {
            loadBtn.disabled = true;
            analyzeBtn.disabled = true;
            statusEl.textContent = "正在加载角色、人设、记忆和最近聊天...";
            resultEl.textContent = "数据加载中。";

            const charData = await roche.character.get(charId);
            const userData = await roche.persona.getActiveUserPersona();

            if (!charData || !charData.conversationId) {
              throw new Error("这个角色没有 conversationId，无法读取对应记忆。");
            }

            const shortTerm = await roche.memory.getShortTerm({
              conversationId: charData.conversationId,
              limit: 50
            });

            const longTerm = await roche.memory.getLongTerm({
              conversationId: charData.conversationId,
              limit: 100
            });

            currentData = {
              charData,
              userData,
              shortTerm: shortTerm || [],
              longTerm: longTerm || {}
            };

            const charName = charData.handle || charData.name || charData.displayName || charData.id;
            const userName = userData && (userData.handle || userData.name || userData.displayName) || "当前用户";

            summaryEl.textContent =
              `角色：${charName}\n` +
              `用户：${userName}\n` +
              `最近聊天：${countValue(shortTerm)} 条\n` +
              `核心记忆：${countValue(longTerm && longTerm.core)} 条/段\n` +
              `事实记忆：${countValue(longTerm && longTerm.facts)} 条\n` +
              `向量记忆记录：${countValue(longTerm && longTerm.vectors)} 条`;

            statusEl.textContent = "加载完成。现在可以点 AI 分析建议。";
            resultEl.textContent = "数据已加载。点“AI 分析建议”会消耗你当前 Roche AI 配置的 API/token。";
            analyzeBtn.disabled = false;
          } catch (err) {
            statusEl.textContent = "加载失败：" + (err && err.message ? err.message : err);
            resultEl.textContent = "加载失败。可以截图给我看。";
          } finally {
            loadBtn.disabled = false;
          }
        };

        analyzeBtn.onclick = async () => {
          if (!currentData) {
            resultEl.textContent = "请先加载数据。";
            return;
          }

          try {
            analyzeBtn.disabled = true;
            resultEl.textContent = "AI 正在分析中，这一步会消耗 API/token...";

            const char = currentData.charData;
            const user = currentData.userData || {};
            const lt = currentData.longTerm || {};

            const prompt = `
你是 Roche 记忆体检助手。请只做整理建议，不要续写剧情，不要扮演角色。

【任务】
根据下面的角色人设、用户人设、核心记忆、事实记忆、最近 50 条聊天，检查记忆质量。

【请输出】
1. 重复记忆：列出重复或高度相似的内容，并说明建议合并成什么。
2. 废话记忆：列出日常寒暄、低价值、没必要长期保存的内容。
3. 设定冲突：列出角色人设、用户人设、核心记忆、事实记忆之间的矛盾。
4. 应该保留：列出真正重要、会影响长期关系/剧情/人物设定的内容。
5. 可以压缩：把冗长记忆压缩成更短的版本。
6. 最终建议：按“保留 / 合并 / 删除 / 需要人工确认”分类。

【限制】
- 不要编造资料里没有的信息。
- 不要自动写入 Roche 主记忆。
- 输出中文。
- 尽量具体，方便用户手动整理。

【角色资料】
角色名：${safeText(char.handle || char.name || char.displayName)}
角色人设：
${safeText(char.persona || char.bio || char.description || "")}

【用户资料】
用户名：${safeText(user.handle || user.name || user.displayName)}
用户人设：
${safeText(user.persona || user.bio || user.description || "")}

【核心记忆】
${safeText(lt.core)}

【事实记忆】
${safeText(lt.facts || [])}

【最近 50 条聊天】
${safeText(currentData.shortTerm || [])}
            `.trim();

            const aiResult = await roche.ai.chat({
              messages: [{ role: "user", content: prompt }],
              temperature: 0.3
            });

            resultEl.textContent = aiResult && aiResult.text ? aiResult.text : "AI 没有返回文本。";
          } catch (err) {
            resultEl.textContent = "AI 分析失败：" + (err && err.message ? err.message : err);
          } finally {
            analyzeBtn.disabled = false;
          }
        };

        await loadCharacters();
      },
      async unmount(container, roche) {
        container.replaceChildren();
      }
    }
  ]
});
