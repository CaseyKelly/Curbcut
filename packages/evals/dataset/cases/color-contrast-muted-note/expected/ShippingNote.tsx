export default function ShippingNote() {
  return (
    <div className="shipping-note" style={{ background: '#ffffff', color: '#1f2933' }}>
      <p>Free delivery on orders over £40.</p>
      <p style={{ color: '#595959', fontSize: '14px' }}>
        Orders placed after 2pm ship the next working day.
      </p>
    </div>
  );
}
