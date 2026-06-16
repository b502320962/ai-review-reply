// Supabase Edge Function: generate-reply
// 部署命令: supabase functions deploy generate-reply

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const TONE_PROMPTS: Record<string, string> = {
  professional: "Write a professional and business-like reply. Be courteous, formal, and solution-oriented.",
  friendly: "Write a warm and friendly reply. Be approachable, positive, and conversational.",
  apologetic: "Write an apologetic and understanding reply. Acknowledge the issue, show empathy, and offer solutions.",
  grateful: "Write a grateful and appreciative reply. Thank the customer sincerely and express genuine appreciation.",
};

const PLATFORM_PROMPTS: Record<string, string> = {
  google: "Format for Google Business reply. Keep it concise (under 300 words), professional.",
  yelp: "Format for Yelp business reply. Be personable, address specific points from the review.",
  wechat: "Format for WeChat Official Account reply. Use polite and professional Chinese. Keep the reply concise and helpful.",
};

serve(async (req: Request) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    // 验证用户身份
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(
        JSON.stringify({ success: false, message: "Missing authorization" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // 创建 Supabase 客户端
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey, {
      global: { headers: { Authorization: authHeader } },
    });

    // 获取当前用户
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return new Response(
        JSON.stringify({ success: false, message: "Unauthorized" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // 检查用户额度
    const { data: profile } = await supabase
      .from("user_profiles")
      .select("credits_total, credits_used, plan")
      .eq("id", user.id)
      .single();

    if (!profile) {
      return new Response(
        JSON.stringify({ success: false, message: "User profile not found" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const creditsRemaining = profile.credits_total - profile.credits_used;
    if (creditsRemaining <= 0) {
      return new Response(
        JSON.stringify({
          success: false,
          message: "No credits remaining. Please upgrade to Pro.",
          code: "NO_CREDITS",
        }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // 解析请求体
    const { review, tone = "professional", platform = "google" } = await req.json();

    if (!review) {
      return new Response(
        JSON.stringify({ success: false, message: "Review text is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // 获取 AI 配置
    const { data: aiConfig } = await supabase
      .from("ai_configs")
      .select("*")
      .eq("is_default", true)
      .single();

    if (!aiConfig || !aiConfig.api_key) {
      return new Response(
        JSON.stringify({ success: false, message: "AI service not configured" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // 构建 prompt
    const tonePrompt = TONE_PROMPTS[tone] || TONE_PROMPTS.professional;
    const platformPrompt = PLATFORM_PROMPTS[platform] || PLATFORM_PROMPTS.google;

    const systemPrompt = `You are an AI assistant helping businesses reply to customer reviews.
Your task is to generate a professional, helpful reply to the given review.

Guidelines:
${tonePrompt}
${platformPrompt}
- Address specific points mentioned in the review
- Be authentic and genuine
- Keep the reply appropriate for the platform
- Do not use placeholder text like [Business Name]
- Return ONLY the reply text, no explanations`;

    // 调用 DeepSeek API
    const aiResponse = await fetch(aiConfig.api_url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${aiConfig.api_key}`,
      },
      body: JSON.stringify({
        model: aiConfig.model,
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: `Please generate a reply to this customer review:\n\n"${review}"` },
        ],
        temperature: 0.7,
        max_tokens: 500,
      }),
    });

    if (!aiResponse.ok) {
      const error = await aiResponse.json().catch(() => ({}));
      throw new Error(error.error?.message || "AI API request failed");
    }

    const aiData = await aiResponse.json();
    const reply = aiData.choices?.[0]?.message?.content?.trim();

    if (!reply) {
      throw new Error("No reply generated");
    }

    // 扣除额度
    await supabase
      .from("user_profiles")
      .update({ credits_used: profile.credits_used + 1, updated_at: new Date().toISOString() })
      .eq("id", user.id);

    // 记录使用日志
    await supabase.from("usage_logs").insert({
      user_id: user.id,
      platform,
      tone,
      review_text: review,
      reply_text: reply,
      tokens_used: aiData.usage?.total_tokens || 0,
    });

    return new Response(
      JSON.stringify({
        success: true,
        data: {
          reply,
          creditsRemaining: creditsRemaining - 1,
        },
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Error:", error);
    return new Response(
      JSON.stringify({
        success: false,
        message: error instanceof Error ? error.message : "Internal server error",
      }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
