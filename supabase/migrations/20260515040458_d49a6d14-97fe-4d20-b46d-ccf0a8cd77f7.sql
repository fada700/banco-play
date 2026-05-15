
REVOKE EXECUTE ON FUNCTION public.op_depositar(numeric) FROM anon, authenticated, public;
REVOKE EXECUTE ON FUNCTION public.op_retirar(numeric) FROM anon, authenticated, public;
REVOKE EXECUTE ON FUNCTION public.op_transferir(text, numeric, text) FROM anon, authenticated, public;
REVOKE EXECUTE ON FUNCTION public.toggle_tarjeta_debito() FROM anon, authenticated, public;
