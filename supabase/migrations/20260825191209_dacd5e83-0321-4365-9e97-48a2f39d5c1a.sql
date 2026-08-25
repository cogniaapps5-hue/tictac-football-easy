CREATE OR REPLACE FUNCTION public.payments_guard_parent_update()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  IF public.has_role(auth.uid(), 'admin') THEN
    RETURN NEW;
  END IF;

  -- Los apoderados SOLO pueden modificar receipt_url. Comparamos la fila
  -- completa con la original (neutralizando receipt_url); si algo más cambió,
  -- se rechaza la operación.
  IF to_jsonb(NEW) - 'receipt_url' IS DISTINCT FROM to_jsonb(OLD) - 'receipt_url' THEN
    RAISE EXCEPTION 'Solo la administradora puede modificar los datos del pago';
  END IF;

  RETURN NEW;
END;
$function$;