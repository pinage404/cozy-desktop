import "bunyan" as bunyan;

def is_net_error: .msg | test("net::");
def is_maintenance: .msg | test("Maintenance en cours");

def remove_useless_errors:
  select((is_net_error | not) and (is_maintenance | not));

def find_errors:
  [.[] | bunyan::find_errors | remove_useless_errors | {path,msg}];

def find_warn_paths:
  [.[] | bunyan::select_warns | remove_useless_errors | {path,msg}];
