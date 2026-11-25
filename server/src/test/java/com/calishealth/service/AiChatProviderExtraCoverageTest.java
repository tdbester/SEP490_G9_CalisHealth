package com.calishealth.service;

import com.calishealth.dtos.AiSupportDtos.AnswerResponse;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

/** Bo sung coverage cho {@link AiChatProvider} va cac provider con. */
class AiChatProviderExtraCoverageTest {

    @Test
    @DisplayName("providerName: mac dinh = model()")
    void providerNameDefaultsToModel() {
        AiChatProvider provider = new StubProvider("gpt-4o-mini");

        assertThat(provider.providerName()).isEqualTo("gpt-4o-mini");
    }

    @Test
    @DisplayName("stripMarkdownFence: raw null -> null")
    void stripFenceKeepsNull() {
        assertThat(AiChatProvider.stripMarkdownFence(null)).isNull();
    }

    @Test
    @DisplayName("stripMarkdownFence: khong co fence -> trim")
    void stripFenceTrimsPlainText() {
        assertThat(AiChatProvider.stripMarkdownFence("  hello  ")).isEqualTo("hello");
    }

    @Test
    @DisplayName("stripMarkdownFence: fence khong co dong moi -> tra nguyen")
    void stripFenceKeepsFenceWithoutNewline() {
        assertThat(AiChatProvider.stripMarkdownFence("```json")).isEqualTo("```json");
    }

    @Test
    @DisplayName("stripMarkdownFence: bo fence mo va dong")
    void stripFenceRemovesBothFences() {
        String raw = "```json\n{\"a\":1}\n```";

        assertThat(AiChatProvider.stripMarkdownFence(raw)).isEqualTo("{\"a\":1}");
    }

    @Test
    @DisplayName("ProviderException: giu ma loi va nguyen nhan")
    void providerExceptionKeepsCodeAndCause() {
        RuntimeException cause = new RuntimeException("boom");
        AiChatProvider.ProviderException error =
                new AiChatProvider.ProviderException("AI_UPSTREAM", "AI Support is busy", cause);

        assertThat(error.getCode()).isEqualTo("AI_UPSTREAM");
        assertThat(error.getMessage()).isEqualTo("AI Support is busy");
        assertThat(error.getCause()).isSameAs(cause);
    }

    @Test
    @DisplayName("toAnswer: JSON hop le -> tach causes, tip va followUps")
    void toAnswerParsesStructuredJson() {
        OpenAiChatService service = new OpenAiChatService("key", "gpt-4o-mini",
                "https://api.openai.com", 5, 512, true);

        AnswerResponse answer = service.toAnswer("""
                {"causes":[{"title":"Too fast","detail":"Slow down"},{"title":"  ","detail":"ignored"}],
                 "tip":"Breathe out","followUps":["How to rest?","","Second?"]}
                """);

        assertThat(answer.causes()).hasSize(1);
        assertThat(answer.causes().get(0).title()).isEqualTo("Too fast");
        assertThat(answer.tip()).isEqualTo("Breathe out");
        assertThat(answer.followUps()).containsExactly("How to rest?", "Second?");
    }

    @Test
    @DisplayName("toAnswer: raw null -> khong co nguyen nhan")
    void toAnswerHandlesNullContent() {
        OpenAiChatService service = new OpenAiChatService("key", "gpt-4o-mini",
                "https://api.openai.com", 5, 512, true);

        AnswerResponse answer = service.toAnswer(null);

        assertThat(answer.causes()).isEmpty();
        assertThat(answer.tip()).isEmpty();
    }

    @Test
    @DisplayName("toAnswer: JSON hong -> dung plain text lam mot nguyen nhan")
    void toAnswerFallsBackToPlainText() {
        OpenAiChatService service = new OpenAiChatService("key", "gpt-4o-mini",
                "https://api.openai.com", 5, 512, true);

        AnswerResponse answer = service.toAnswer("just some plain feedback");

        assertThat(answer.causes()).hasSize(1);
        assertThat(answer.causes().get(0).title()).isEqualTo("AI coach feedback");
        assertThat(answer.causes().get(0).detail()).isEqualTo("just some plain feedback");
    }

    @Test
    @DisplayName("Gemini toAnswer: JSON hong -> fallback plain text")
    void geminiToAnswerFallsBackToPlainText() {
        GeminiChatService service = new GeminiChatService("key", "gemini-3.5-flash",
                "https://generativelanguage.googleapis.com", 5, 512, true);

        AnswerResponse answer = service.toAnswer("plain gemini text");

        assertThat(answer.causes()).hasSize(1);
        assertThat(answer.causes().get(0).detail()).isEqualTo("plain gemini text");
    }

    @Test
    @DisplayName("Gemini toAnswer: JSON hop le -> tach causes")
    void geminiToAnswerParsesStructuredJson() {
        GeminiChatService service = new GeminiChatService("key", "gemini-3.5-flash",
                "https://generativelanguage.googleapis.com", 5, 512, true);

        AnswerResponse answer = service.toAnswer("""
                {"causes":[{"title":"Depth too shallow","detail":"Engage the core"}],
                 "tip":"Brace harder","followUps":["Try again?"]}
                """);

        assertThat(answer.causes()).hasSize(1);
        assertThat(answer.tip()).isEqualTo("Brace harder");
        assertThat(answer.followUps()).containsExactly("Try again?");
    }

    @Test
    @DisplayName("Provider: chat voi danh sach rong -> IllegalArgumentException")
    void chatRejectsEmptyMessageList() {
        GeminiChatService service = new GeminiChatService("key", "gemini-3.5-flash",
                "https://generativelanguage.googleapis.com", 5, 512, true);

        assertThatThrownBy(() -> service.chat("system", java.util.List.of()))
                .isInstanceOf(IllegalArgumentException.class);
    }

    @Test
    @DisplayName("Provider: chua cau hinh API key -> AI_NOT_CONFIGURED")
    void chatFailsWhenNotConfigured() {
        GeminiChatService service = new GeminiChatService("", "gemini-3.5-flash",
                "https://generativelanguage.googleapis.com", 5, 512, true);

        assertThat(service.isConfigured()).isFalse();
        assertThatThrownBy(() -> service.chat("system", "hello"))
                .isInstanceOf(com.calishealth.exception.OpenAiException.class)
                .satisfies(e -> assertThat(((com.calishealth.exception.OpenAiException) e).getCode())
                        .isEqualTo("AI_NOT_CONFIGURED"));
    }

    /** Provider gia lap chi de kiem tra default method cua interface. */
    private static final class StubProvider implements AiChatProvider {
        private final String model;

        private StubProvider(String model) {
            this.model = model;
        }

        @Override
        public boolean isConfigured() {
            return true;
        }

        @Override
        public String model() {
            return model;
        }

        @Override
        public boolean isDemoFallbackEnabled() {
            return false;
        }

        @Override
        public ChatResult chat(String systemPrompt, String userPrompt) {
            return new ChatResult("ok", 1);
        }

        @Override
        public ChatResult chat(String systemPrompt, java.util.List<ChatMessage> messages) {
            return new ChatResult("ok", 1);
        }

        @Override
        public AnswerResponse toAnswer(String rawContent) {
            return new AnswerResponse(java.util.List.of(), "", java.util.List.of());
        }
    }
}
