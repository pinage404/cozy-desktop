def error_level: 50;
def warn_level: 40;
def is_error: .level >= error_level;
def find_errors: select(is_error);

def select_level_strict(level): select(.level == level);
def select_warns: select_level_strict(warn_level);
