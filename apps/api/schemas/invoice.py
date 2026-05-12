"""Fatura şemaları — Pass 1 (parse_invoice_pdf) çıktısı."""
from datetime import date as date_t
from pydantic import BaseModel, Field, ConfigDict


class InvoiceItem(BaseModel):
    model_config = ConfigDict(extra="forbid")
    description: str = Field(description="Kalem açıklaması")
    quantity: float = Field(ge=0, description="Miktar")
    unit_price: float = Field(ge=0, description="Birim fiyat (KDV hariç)")
    total: float = Field(ge=0, description="Satır toplamı (KDV hariç)")
    kdv_rate: float = Field(ge=0, le=100, description="KDV oranı (%)")


class InvoiceData(BaseModel):
    model_config = ConfigDict(extra="forbid")
    invoice_id: str = Field(description="Fatura UUID")
    vendor_name: str = Field(description="Tedarikçi adı")
    vendor_tax_no: str | None = Field(description="VKN — yoksa 'NOT_MENTIONED'")
    date: date_t = Field(description="Fatura tarihi")
    due_date: date_t | None = Field(description="Vade tarihi — yoksa None/NOT_MENTIONED")
    items: list[InvoiceItem] = Field(description="Kalemler")
    subtotal: float = Field(ge=0, description="KDV hariç ara toplam")
    kdv_amount: float = Field(ge=0, description="Toplam KDV tutarı")
    total_amount: float = Field(ge=0, description="KDV dahil genel toplam")
    currency: str = Field(default="TRY", description="Para birimi")
    category: str = Field(description="Kategori (gelir/gider sınıflandırması)")
    raw_text: str | None = Field(description="OCR ham metin — yoksa None")
