import { formatDate, formatPrice, formatQty, PAYMENT_LABEL, shortId, type ItemPedido, type Pedido } from '@/lib/pedidos/format'

interface OrderPrintViewProps {
  pedido: Pedido
  itens: ItemPedido[] | undefined
  nomeLoja: string
}

export function OrderPrintView({ pedido, itens, nomeLoja }: OrderPrintViewProps) {
  const isManual = pedido.origem === 'manual'

  return (
    <div className="print-area">
      <style>{`
        .print-area {
          display: none;
          font-family: 'Courier New', Courier, monospace;
          font-size: 12px;
          color: #000;
          width: 300px;
          padding: 16px 8px;
          line-height: 1.5;
        }
        @media print {
          body * { visibility: hidden; }
          .print-area { display: block !important; }
          .print-area, .print-area * { visibility: visible; }
          .print-area {
            position: fixed;
            top: 0;
            left: 0;
            width: 300px;
            padding: 16px 8px;
          }
        }
        .print-divider {
          border: none;
          border-top: 1px dashed #000;
          margin: 8px 0;
        }
        .print-row {
          display: flex;
          justify-content: space-between;
          gap: 8px;
        }
      `}</style>

      {/* Cabeçalho */}
      <div style={{ textAlign: 'center', marginBottom: '12px' }}>
        <div style={{ fontWeight: 'bold', fontSize: '14px' }}>{nomeLoja}</div>
        <div style={{ fontSize: '11px', marginTop: '2px' }}>COMANDA DE PEDIDO</div>
      </div>

      <hr className="print-divider" />

      <div className="print-row">
        <span>Pedido:</span>
        <span style={{ fontWeight: 'bold' }}>#{shortId(pedido.id)}</span>
      </div>
      <div className="print-row">
        <span>Data:</span>
        <span>{formatDate(pedido.criado_em)}</span>
      </div>
      <div className="print-row">
        <span>Tipo:</span>
        <span>{isManual ? 'Balcão' : 'Delivery'}</span>
      </div>

      <hr className="print-divider" />

      {/* Cliente */}
      <div style={{ marginBottom: '4px', fontWeight: 'bold' }}>CLIENTE</div>
      <div>{pedido.nome_cliente || (isManual ? 'Cliente do balcão' : '—')}</div>
      {pedido.telefone_cliente && (
        <div>Tel: {pedido.telefone_cliente}</div>
      )}
      {!isManual && pedido.endereco_entrega && (
        <div style={{ marginTop: '2px' }}>End: {pedido.endereco_entrega}</div>
      )}

      <hr className="print-divider" />

      {/* Itens */}
      <div style={{ marginBottom: '4px', fontWeight: 'bold' }}>ITENS</div>
      {itens && itens.length > 0 ? (
        <div>
          {itens.map((item, i) => (
            <div key={i} style={{ marginBottom: '4px' }}>
              <div className="print-row">
                <span style={{ flex: 1 }}>
                  {formatQty(item.quantidade, item.unidade)}x {item.nome_produto}
                </span>
                <span style={{ whiteSpace: 'nowrap' }}>{formatPrice(item.subtotal)}</span>
              </div>
              {item.preco_unitario > 0 && (
                <div style={{ fontSize: '11px', color: '#555', paddingLeft: '8px' }}>
                  Unit: {formatPrice(item.preco_unitario)}
                </div>
              )}
            </div>
          ))}
        </div>
      ) : (
        <div>—</div>
      )}

      <hr className="print-divider" />

      {/* Totais */}
      <div className="print-row">
        <span>Subtotal</span>
        <span>{formatPrice(pedido.subtotal)}</span>
      </div>
      {!isManual && (
        <div className="print-row">
          <span>Taxa entrega</span>
          <span>{pedido.taxa_entrega === 0 ? 'Grátis' : formatPrice(pedido.taxa_entrega)}</span>
        </div>
      )}
      <div className="print-row" style={{ fontWeight: 'bold', marginTop: '4px' }}>
        <span>TOTAL</span>
        <span>{formatPrice(pedido.total)}</span>
      </div>

      <hr className="print-divider" />

      {/* Pagamento */}
      <div className="print-row">
        <span>Pagamento:</span>
        <span>{PAYMENT_LABEL[pedido.forma_pagamento] ?? pedido.forma_pagamento}</span>
      </div>
      {pedido.troco_para != null && (
        <div className="print-row">
          <span>Troco para:</span>
          <span>{formatPrice(pedido.troco_para)}</span>
        </div>
      )}

      {pedido.observacoes && (
        <>
          <hr className="print-divider" />
          <div style={{ fontWeight: 'bold', marginBottom: '2px' }}>OBS:</div>
          <div>{pedido.observacoes}</div>
        </>
      )}

      <hr className="print-divider" />
      <div style={{ textAlign: 'center', fontSize: '11px', marginTop: '4px' }}>
        Obrigado pela preferência!
      </div>
    </div>
  )
}
