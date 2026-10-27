# frozen_string_literal: true

require 'solidus_core'
require 'solidus_support'

# Defined before the engine loads, or isolate_namespace overrides it with 'solidus_braintree_'.
module SolidusBraintree
  def self.table_name_prefix
    'solidus_paypal_braintree_'
  end
end

require 'solidus_braintree/country_mapper'
require 'solidus_braintree/request_protection'
require 'solidus_braintree/extension_configuration'
require 'solidus_braintree/version'
require 'solidus_braintree/engine'
