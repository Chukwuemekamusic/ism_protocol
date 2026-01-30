emit FallbackActivated in \_getPriceData requires the function to change from view;

Function cannot be declared as view because this expression (potentially) modifies the state.

rm -rf lib/v3-core
