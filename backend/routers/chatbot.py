"""
chatbot.py — TX Energy Risk AI Assistant API router
"""
from fastapi import APIRouter, Header
from pydantic import BaseModel
from typing import List, Optional, Dict
from services.chatbot_service import chat, capture_lead, submit_feedback, get_unanswered

router = APIRouter(prefix="/api/chatbot", tags=["Chatbot"])


class ChatRequest(BaseModel):
    message: str
    session_token: str
    history: List[Dict] = []
    page_context: str = ""


class LeadRequest(BaseModel):
    session_token: str
    email: str
    name: str = ""
    company: str = ""
    role: str = ""
    interest: str = ""
    demo_requested: bool = False


class FeedbackRequest(BaseModel):
    message_id: str
    session_token: str
    helpful: bool
    comment: str = ""


@router.post("/chat")
async def chatbot_chat(req: ChatRequest):
    """Main chat endpoint — RAG + Claude."""
    return await chat(
        message=req.message,
        session_token=req.session_token,
        history=req.history,
        page_context=req.page_context,
    )


@router.post("/lead")
async def chatbot_lead(req: LeadRequest):
    """Capture a lead from the chatbot."""
    return await capture_lead(
        session_token=req.session_token,
        email=req.email,
        name=req.name,
        company=req.company,
        role=req.role,
        interest=req.interest,
        demo_requested=req.demo_requested,
    )


@router.post("/feedback")
async def chatbot_feedback(req: FeedbackRequest):
    """Submit feedback on a response."""
    return await submit_feedback(
        message_id=req.message_id,
        session_token=req.session_token,
        helpful=req.helpful,
        comment=req.comment,
    )


@router.get("/unanswered")
async def chatbot_unanswered(limit: int = 50):
    """Admin: get unanswered questions."""
    return {"questions": await get_unanswered(limit)}
