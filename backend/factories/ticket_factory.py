from abc import ABC, abstractmethod
from fastapi import HTTPException

class TicketPricing(ABC):
    @abstractmethod
    def compute_total(self, base_price: float, quantity: int) -> float:
        pass


class AdultTicketPricing(TicketPricing):
    def compute_total(self, base_price: float, quantity: int) -> float:
        return base_price * quantity


class StudentTicketPricing(TicketPricing):
    def compute_total(self, base_price: float, quantity: int) -> float:
        return base_price * 0.8 * quantity


class ChildTicketPricing(TicketPricing):
    def compute_total(self, base_price: float, quantity: int) -> float:
        return base_price * 0.5 * quantity


class TicketPricingFactory:
    @staticmethod
    def create(ticket_type: str) -> TicketPricing:
        t = ticket_type.lower()

        if t == "adult":
            return AdultTicketPricing()
        if t == "student":
            return StudentTicketPricing()
        if t == "child":
            return ChildTicketPricing()

        raise HTTPException(
            status_code=400,
            detail="Invalid ticket_type (adult / student / child)"
        )
