export const SPECIALIST_AGENTS=['eating-memory','pantry','planning','fresh-shopping','purchase-storage','live-chef'];
export const DEFAULT_RATE_LIMIT_POLICY=Object.freeze({
 id:'pilot-v1',version:1,sessionsPerAgentPerUtcDay:3,totalBillableInvocationsPerUtcDay:30,recursiveSteps:10,specialistHandoffs:3,toolCallsPerModelResponse:5,parallelSpecialists:3,interactionWallClockSeconds:120,concurrentStaticRequests:2,concurrentLiveSessions:1,liveSessionsPerUtcDay:3,maxLiveSeconds:600,totalLiveSecondsPerUtcDay:1200,videoLiveSessionsPerUtcDay:3,maxVideoSeconds:300,totalVideoSecondsPerUtcDay:600,videoFramesPerSecond:1,imagesPerUtcDay:12,imagesPerEvaluation:3,maxUploadBytes:8*1024*1024,receiptsPerUtcDay:3,receiptPages:5,voiceClipsPerUtcDay:10,maxVoiceClipSeconds:60,totalVoiceSecondsPerUtcDay:600,staticBurstPerMinute:10,maxRagChunks:8,maxRagChunkTokens:700,maxOutputTokens:2000,maxContextTokens:12000,killSwitch:false
});
export const ADMIN_ROLES=Object.freeze({
 super_admin:['*'],security_admin:['security:read','security:write','audit:read'],agent_governance_admin:['agents:read','agents:write','quotas:write'],prompt_admin:['prompts:read','prompts:write','prompts:publish'],rag_content_admin:['rag:read','rag:write','rag:approve'],operations_admin:['operations:read','incidents:write','quotas:override'],support_readonly:['users:masked','operations:read'],audit_readonly:['audit:read']
});
export const isAllowed=(role,permission)=>ADMIN_ROLES[role]?.includes('*')||ADMIN_ROLES[role]?.includes(permission);
