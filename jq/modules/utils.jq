def frequencies:
  reduce .[] as $x ({};
    . as $counts | $counts + {($x): (1 + (($counts|getpath([$x])) // 0))}
  );

# (reduce (fn [counts x]
#   (assoc! counts x (inc (get counts x 0)))
#   coll)
